const { ethers, network, run } = require("hardhat");

const VERIFY_DELAY_SECONDS = Number(process.env.VERIFY_DELAY_SECONDS || 30);
const VERIFY_CONFIRMATIONS = Number(process.env.VERIFY_CONFIRMATIONS || 5);

function shouldVerify() {
  return process.env.VERIFY === "true";
}

function isLocalNetwork() {
  return network.name === "hardhat" || network.name === "localhost";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyContract(address) {
  if (!shouldVerify()) {
    console.log("Verification skipped. Set VERIFY=true to run hardhat verify.");
    return;
  }

  if (isLocalNetwork()) {
    console.log(`Verification skipped on local network '${network.name}'.`);
    return;
  }

  if (VERIFY_DELAY_SECONDS > 0) {
    console.log(`Waiting ${VERIFY_DELAY_SECONDS}s before verification...`);
    await sleep(VERIFY_DELAY_SECONDS * 1000);
  }

  try {
    await run("verify:verify", {
      address,
      constructorArguments: [],
    });
    console.log("Verification submitted.");
  } catch (error) {
    const message = error.message || "";
    if (message.toLowerCase().includes("already verified")) {
      console.log("Contract is already verified.");
      return;
    }
    throw error;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const providerNetwork = await ethers.provider.getNetwork();
  const balanceBefore = await ethers.provider.getBalance(deployer.address);

  console.log(`Network: ${network.name} (${providerNetwork.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance before: ${ethers.formatEther(balanceBefore)} ETH`);

  const Cromcoin = await ethers.getContractFactory("Cromcoin");
  const cromcoin = await Cromcoin.deploy();
  const deploymentTx = cromcoin.deploymentTransaction();

  console.log(`Deployment tx: ${deploymentTx.hash}`);
  await cromcoin.waitForDeployment();

  if (shouldVerify() && !isLocalNetwork()) {
    console.log(`Waiting for ${VERIFY_CONFIRMATIONS} deployment confirmations...`);
    await deploymentTx.wait(VERIFY_CONFIRMATIONS);
  }

  const address = await cromcoin.getAddress();
  const balanceAfter = await ethers.provider.getBalance(deployer.address);
  const spent = balanceBefore - balanceAfter;

  console.log(`Cromcoin deployed: ${address}`);
  console.log(`Balance after: ${ethers.formatEther(balanceAfter)} ETH`);
  console.log(`Deployment cost: ${ethers.formatEther(spent)} ETH`);

  await verifyContract(address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
