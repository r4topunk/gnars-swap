import { ethers } from "hardhat";

const MOCK_NFT = "0xcaBa79dFa3887705bF1A7A880DEe0888470CBF53";
const RECIPIENT = "0x39a7B6fa1597BB6657Fe84e64E3B836c37d6F75d";
const COUNT = 5;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Minting with:", signer.address);

  const nft = await ethers.getContractAt("MockERC721", MOCK_NFT, signer);

  for (let i = 0; i < COUNT; i++) {
    const tx = await nft.mint(RECIPIENT);
    const receipt = await tx.wait();
    console.log(`Minted token to ${RECIPIENT} (tx: ${receipt!.hash})`);
  }

  console.log(`\nDone — minted ${COUNT} tokens to ${RECIPIENT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
