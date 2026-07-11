// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Cromcoin.sol";

/**
 * @dev Test-only contract. Lowers PoW difficulty from 20 to 4 bits so the
 *      JavaScript brute-force completes in milliseconds instead of seconds.
 *      Never deploy this to mainnet.
 */
contract CromcoinHarness is Cromcoin {
    function _difficulty() internal pure override returns (uint256) {
        return 4;
    }

    function hasLeadingZeroBits(bytes32 hash, uint256 bits) external pure returns (bool) {
        return _hasLeadingZeroBits(hash, bits);
    }
}
