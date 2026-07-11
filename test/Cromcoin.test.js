const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// ─── Constants ───────────────────────────────────────────────────────────────
// Tests deploy CromcoinHarness (difficulty=4) so the JS brute-force is instant.
// The production DIFFICULTY constant (20) is verified as a separate read-only test.
const TEST_DIFFICULTY = 4;
const BLOCK_WINDOW_SIZE = 10;
const REWARD = 1000n;
const COOLDOWN_SECS = 86_400;

// Storage slot of `mineBalance` in Cromcoin.
// Inheritance chain: ERC20 (slots 0-4) → Ownable (slot 5) → Cromcoin
//   slot 6: lastClaimed   slot 7: usedNonces   slot 8: mineBalance
const MINE_BALANCE_SLOT = "0x" + (8n).toString(16).padStart(64, "0");

// ─── PoW helpers (mirror the Solidity logic exactly) ─────────────────────────

function uint256ToBytes(n) {
  const bytes = new Uint8Array(32);
  let v = BigInt(n);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}

function buildTarget(bits) {
  const target = new Uint8Array(32).fill(0xff);
  const fullBytes = Math.floor(bits / 8);
  for (let i = 0; i < fullBytes; i++) target[i] = 0;
  const rem = bits % 8;
  if (rem > 0) target[fullBytes] = 0xff >> rem;
  return target;
}

function meetsTarget(hashBytes, target) {
  for (let i = 0; i < 32; i++) {
    if (hashBytes[i] < target[i]) return true;
    if (hashBytes[i] > target[i]) return false;
  }
  return true;
}

// Brute-force keccak256(abi.encodePacked(address, nonce, blockWindow)).
// Random start avoids always finding the same nonce for the same (addr, window),
// which would cause "nonce already used" when the same wallet mines twice within
// one block window (e.g. in the post-cooldown test).
function findValidNonce(signerAddress, blockWindow, difficulty = TEST_DIFFICULTY) {
  const addrBytes = ethers.getBytes(signerAddress);
  const windowBytes = uint256ToBytes(BigInt(blockWindow));
  // abi.encodePacked(address, uint256, uint256) = 20 + 32 + 32 = 84 bytes
  const packed = new Uint8Array(84);
  packed.set(addrBytes, 0);
  packed.set(windowBytes, 52);

  const target = buildTarget(difficulty);
  let nonce = BigInt(Math.floor(Math.random() * 2 ** 32));

  while (true) {
    nonce++;
    packed.set(uint256ToBytes(nonce), 20);
    const hash = ethers.getBytes(ethers.keccak256(packed));
    if (meetsTarget(hash, target)) return nonce;
  }
}

// Returns the block window the NEXT transaction will execute in.
async function nextBlockWindow() {
  const blockNum = await ethers.provider.getBlockNumber();
  return Math.floor((blockNum + 1) / BLOCK_WINDOW_SIZE);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Cromcoin", function () {
  let cromcoin;
  let owner, miner;

  beforeEach(async function () {
    [owner, miner] = await ethers.getSigners();
    // Deploy the test harness (difficulty=4) for fast PoW brute-forcing.
    const Factory = await ethers.getContractFactory("CromcoinHarness");
    cromcoin = await Factory.deploy();
    await cromcoin.waitForDeployment();
  });

  // ── 1. Deployment ──────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("total supply is 1 billion, all held by the contract", async function () {
      const addr = await cromcoin.getAddress();
      expect(await cromcoin.totalSupply()).to.equal(1_000_000_000n);
      expect(await cromcoin.balanceOf(addr)).to.equal(1_000_000_000n);
      expect(await cromcoin.mineBalance()).to.equal(1_000_000_000n);
    });

    it("owner wallet starts with 0 CROMCOIN", async function () {
      expect(await cromcoin.balanceOf(owner.address)).to.equal(0n);
    });

    it("production DIFFICULTY constant is 20", async function () {
      expect(await cromcoin.DIFFICULTY()).to.equal(20n);
    });
  });

  // ── 2. decimals() ──────────────────────────────────────────────────────────
  describe("decimals()", function () {
    it("returns 0", async function () {
      expect(await cromcoin.decimals()).to.equal(0);
    });
  });

  describe("_hasLeadingZeroBits()", function () {
    it("returns true for 0 required bits", async function () {
      expect(await cromcoin.hasLeadingZeroBits(ethers.ZeroHash, 0)).to.equal(true);
    });

    it("checks the production 20-bit boundary", async function () {
      const passingHash =
        "0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      const failingHash =
        "0x0000100000000000000000000000000000000000000000000000000000000000";

      expect(await cromcoin.hasLeadingZeroBits(passingHash, 20)).to.equal(true);
      expect(await cromcoin.hasLeadingZeroBits(failingHash, 20)).to.equal(false);
    });

    it("handles a full 256-bit zero requirement", async function () {
      const almostZero =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      expect(await cromcoin.hasLeadingZeroBits(ethers.ZeroHash, 256)).to.equal(true);
      expect(await cromcoin.hasLeadingZeroBits(almostZero, 256)).to.equal(false);
    });
  });

  // ── 3. mine() — invalid PoW ────────────────────────────────────────────────
  describe("mine() — invalid proof-of-work", function () {
    it("reverts when nonce=0 does not meet difficulty", async function () {
      await expect(cromcoin.connect(miner).mine(0n)).to.be.revertedWith(
        "Cromcoin: invalid proof-of-work"
      );
    });
  });

  // ── 4. mine() — valid PoW ─────────────────────────────────────────────────
  describe("mine() — valid proof-of-work", function () {
    it("transfers 1000 CROMCOIN to the caller and emits Mined", async function () {
      const window = await nextBlockWindow();
      const nonce = findValidNonce(miner.address, window);

      await expect(cromcoin.connect(miner).mine(nonce))
        .to.emit(cromcoin, "Mined")
        .withArgs(miner.address, REWARD, 1_000_000_000n - REWARD);

      expect(await cromcoin.balanceOf(miner.address)).to.equal(REWARD);
    });
  });

  // ── 5. mine() — cooldown blocks second call ────────────────────────────────
  describe("mine() — cooldown", function () {
    it("reverts if called again within 24 hours", async function () {
      const window = await nextBlockWindow();
      const nonce = findValidNonce(miner.address, window);
      await cromcoin.connect(miner).mine(nonce);

      await expect(cromcoin.connect(miner).mine(0n)).to.be.revertedWith(
        "Cromcoin: cooldown active - come back tomorrow"
      );
    });
  });

  // ── 6. mine() — allowed again after 24 h ──────────────────────────────────
  describe("mine() — post-cooldown", function () {
    it("allows the same wallet to claim again after 24 hours", async function () {
      // First mine
      let window = await nextBlockWindow();
      let nonce = findValidNonce(miner.address, window);
      await cromcoin.connect(miner).mine(nonce);

      // Advance past cooldown (time.increase also mines one block)
      await time.increase(COOLDOWN_SECS + 1);

      // Second mine — random start nonce avoids "nonce already used"
      window = await nextBlockWindow();
      nonce = findValidNonce(miner.address, window);
      await cromcoin.connect(miner).mine(nonce);

      expect(await cromcoin.balanceOf(miner.address)).to.equal(REWARD * 2n);
    });
  });

  // ── 7. cooldownRemaining() ────────────────────────────────────────────────
  describe("cooldownRemaining()", function () {
    it("returns 0 before any claim", async function () {
      expect(await cromcoin.cooldownRemaining(miner.address)).to.equal(0n);
    });

    it("returns ~86400 right after a claim and 0 after 24 hours", async function () {
      const window = await nextBlockWindow();
      const nonce = findValidNonce(miner.address, window);
      await cromcoin.connect(miner).mine(nonce);

      const remaining = await cromcoin.cooldownRemaining(miner.address);
      expect(remaining).to.be.gt(0n);
      expect(remaining).to.be.lte(86_400n);

      await time.increase(COOLDOWN_SECS + 1);
      expect(await cromcoin.cooldownRemaining(miner.address)).to.equal(0n);
    });
  });

  // ── 8. sessionsRemaining() ────────────────────────────────────────────────
  describe("sessionsRemaining()", function () {
    it("starts at 1,000,000", async function () {
      expect(await cromcoin.sessionsRemaining()).to.equal(1_000_000n);
    });

    it("decrements by 1 after each successful mine", async function () {
      const window = await nextBlockWindow();
      const nonce = findValidNonce(miner.address, window);
      await cromcoin.connect(miner).mine(nonce);

      expect(await cromcoin.sessionsRemaining()).to.equal(999_999n);
    });
  });

  // ── 9. MineExhausted event ────────────────────────────────────────────────
  describe("MineExhausted event", function () {
    it("emits MineExhausted when the last coins are claimed", async function () {
      const addr = await cromcoin.getAddress();

      // Fast-forward mineBalance to exactly REWARD_PER_MINE via storage slot 8
      await network.provider.send("hardhat_setStorageAt", [
        addr,
        MINE_BALANCE_SLOT,
        "0x" + REWARD.toString(16).padStart(64, "0"),
      ]);

      // Verify the slot is correct before proceeding
      expect(await cromcoin.mineBalance()).to.equal(REWARD);
      expect(await cromcoin.sessionsRemaining()).to.equal(1n);

      const window = await nextBlockWindow();
      const nonce = findValidNonce(miner.address, window);

      await expect(cromcoin.connect(miner).mine(nonce)).to.emit(
        cromcoin,
        "MineExhausted"
      );

      expect(await cromcoin.mineBalance()).to.equal(0n);
      expect(await cromcoin.sessionsRemaining()).to.equal(0n);
    });
  });
});
