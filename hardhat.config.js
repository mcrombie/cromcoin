require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);
// A single Etherscan API key (from https://etherscan.io/apidashboard) verifies on
// Base and Base Sepolia too — Etherscan API V2 unified per-explorer keys in 2025.
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    base: {
      url: "https://mainnet.base.org",
      chainId: 8453,
      accounts: [PRIVATE_KEY],
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    // Base and Base Sepolia are natively supported by hardhat-verify — no
    // customChains block needed. One key covers both.
    apiKey: ETHERSCAN_API_KEY,
  },
};
