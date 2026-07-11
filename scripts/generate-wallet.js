const { ethers } = require("hardhat");

// Generates a fresh throwaway deployer wallet and prints it to your terminal only.
// Nothing is written to disk or sent anywhere — copy the private key into your
// local .env yourself, then fund the address via a Base Sepolia faucet before
// deploying. Treat it as disposable: don't reuse it for anything holding real value.
function main() {
  const wallet = ethers.Wallet.createRandom();

  console.log("\nNew deployer wallet generated (not saved anywhere):\n");
  console.log(`  Address:     ${wallet.address}`);
  console.log(`  Private key: ${wallet.privateKey}\n`);
  console.log("Next steps:");
  console.log("  1. Copy the private key into .env as PRIVATE_KEY=<key above>");
  console.log("  2. Fund the address with Base Sepolia ETH via the Coinbase Developer");
  console.log("     Platform faucet (0.1 ETH / 24h): https://portal.cdp.coinbase.com/products/faucet");
  console.log("  3. Get a free Etherscan API key (covers Base + Base Sepolia verification");
  console.log("     via Etherscan API V2) and add it to .env as ETHERSCAN_API_KEY:");
  console.log("     https://etherscan.io/apidashboard\n");
}

main();
