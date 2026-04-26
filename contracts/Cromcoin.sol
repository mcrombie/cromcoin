// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Cromcoin
 * @notice Fixed-supply ERC-20 token on Base. 1,000,000,000 CROMCOIN.
 *         Distributed via a proof-of-work mining game on crombie.xyz (or wherever).
 *         No burning. No staking. No founder reserve. When the mine is empty, it's gone.
 *
 *         Total sessions possible: 1,000,000 (1B supply / 1,000 per claim)
 *         Rate limit: one claim per wallet per day (86,400 seconds)
 *         PoW difficulty: browser must find a nonce such that
 *                         keccak256(abi.encodePacked(msg.sender, nonce, block.number / BLOCK_WINDOW))
 *                         has DIFFICULTY leading zero bits.
 */
contract Cromcoin is ERC20, Ownable {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant TOTAL_SUPPLY    = 1_000_000_000; // whole coins (0 decimals)
    uint256 public constant REWARD_PER_MINE = 1_000;         // CROMCOIN per successful claim
    uint256 public constant COOLDOWN        = 86_400;        // seconds between claims per wallet
    uint256 public constant DIFFICULTY      = 20;            // leading zero bits required in PoW hash
    uint256 public constant BLOCK_WINDOW    = 10;            // nonce valid across ~10-block window (~20s on Base)

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Timestamp of each wallet's last successful claim
    mapping(address => uint256) public lastClaimed;

    /// @notice Nonces already used within the current block window (prevents replay)
    mapping(bytes32 => bool) public usedNonces;

    /// @notice How many CROMCOIN remain in the mine contract
    uint256 public mineBalance;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Mined(address indexed miner, uint256 amount, uint256 remainingSupply);
    event MineExhausted();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() ERC20("Cromcoin", "CROMCOIN") Ownable(msg.sender) {
        // Mint entire supply to this contract — the mine holds everything
        _mint(address(this), TOTAL_SUPPLY);
        mineBalance = TOTAL_SUPPLY;
    }

    // -------------------------------------------------------------------------
    // Core: decimals override
    // -------------------------------------------------------------------------

    /// @notice 0 decimals — whole coins only, like gold nuggets
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    // -------------------------------------------------------------------------
    // Core: mining claim
    // -------------------------------------------------------------------------

    /**
     * @notice Submit a valid proof-of-work nonce to claim CROMCOIN.
     * @param nonce  The nonce found by the browser's PoW computation.
     *
     * Requirements:
     *  - Caller must not have claimed within the last 24 hours.
     *  - Nonce must not have been used in this block window.
     *  - Hash of (caller, nonce, blockWindow) must satisfy DIFFICULTY leading zero bits.
     *  - Mine must not be exhausted.
     */
    function mine(uint256 nonce) external {
        // 1. Cooldown check
        require(
            block.timestamp >= lastClaimed[msg.sender] + COOLDOWN,
            "Cromcoin: cooldown active - come back tomorrow"
        );

        // 2. Mine exhaustion check
        require(mineBalance >= REWARD_PER_MINE, "Cromcoin: the mine is empty");

        // 3. Replay protection — nonce is scoped to a block window
        uint256 blockWindow = block.number / BLOCK_WINDOW;
        bytes32 nonceKey = keccak256(abi.encodePacked(msg.sender, nonce, blockWindow));
        require(!usedNonces[nonceKey], "Cromcoin: nonce already used");
        usedNonces[nonceKey] = true;

        // 4. Proof-of-work verification
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, nonce, blockWindow));
        require(_hasLeadingZeroBits(hash, DIFFICULTY), "Cromcoin: invalid proof-of-work");

        // 5. Update state
        lastClaimed[msg.sender] = block.timestamp;
        mineBalance -= REWARD_PER_MINE;

        // 6. Transfer reward
        _transfer(address(this), msg.sender, REWARD_PER_MINE);

        emit Mined(msg.sender, REWARD_PER_MINE, mineBalance);

        if (mineBalance == 0) {
            emit MineExhausted();
        }
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    /// @notice Seconds remaining until a wallet can claim again (0 if ready)
    function cooldownRemaining(address wallet) external view returns (uint256) {
        uint256 nextAllowed = lastClaimed[wallet] + COOLDOWN;
        if (block.timestamp >= nextAllowed) return 0;
        return nextAllowed - block.timestamp;
    }

    /// @notice How many sessions remain before the mine is empty
    function sessionsRemaining() external view returns (uint256) {
        return mineBalance / REWARD_PER_MINE;
    }

    /// @notice Returns the current block window (for client-side PoW computation)
    function currentBlockWindow() external view returns (uint256) {
        return block.number / BLOCK_WINDOW;
    }

    // -------------------------------------------------------------------------
    // Internal: PoW validation
    // -------------------------------------------------------------------------

    /**
     * @dev Returns true if `hash` has at least `bits` leading zero bits.
     *      Same mechanism as Bitcoin — hash must be numerically smaller than
     *      a target proportional to difficulty.
     */
    function _hasLeadingZeroBits(bytes32 hash, uint256 bits) internal pure returns (bool) {
        uint256 fullBytes = bits / 8;
        for (uint256 i = 0; i < fullBytes; i++) {
            if (uint8(hash[i]) != 0) return false;
        }
        uint256 remainingBits = bits % 8;
        if (remainingBits > 0) {
            uint8 mask = uint8(0xFF << (8 - remainingBits));
            if (uint8(hash[fullBytes]) & mask != 0) return false;
        }
        return true;
    }
}
