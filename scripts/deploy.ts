import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Network:", network.name);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Deploy MockERC721 for testing (skip on mainnet)
  let gnarsNFTAddress = process.env.GNARS_NFT_ADDRESS;

  if (!gnarsNFTAddress) {
    console.log("\nNo GNARS_NFT_ADDRESS set, deploying MockERC721...");
    const MockERC721 = await ethers.getContractFactory("MockERC721");
    const mockNFT = await MockERC721.deploy("Gnars Test", "GNAR");
    await mockNFT.waitForDeployment();
    gnarsNFTAddress = await mockNFT.getAddress();
    console.log("MockERC721 deployed at:", gnarsNFTAddress);
  }

  // Deploy GnarsSwap
  console.log("\nDeploying GnarsSwap...");
  const GnarsSwap = await ethers.getContractFactory("GnarsSwap");
  const swap = await GnarsSwap.deploy(gnarsNFTAddress);
  await swap.waitForDeployment();
  const swapAddress = await swap.getAddress();
  console.log("GnarsSwap deployed at:", swapAddress);

  console.log("\n--- Summary ---");
  console.log("NFT contract:", gnarsNFTAddress);
  console.log("Swap contract:", swapAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
