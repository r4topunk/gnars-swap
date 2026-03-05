import { expect } from "chai";
import { ethers } from "hardhat";
import { GnarsSwap, MockERC721 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GnarsSwap", function () {
  let swap: GnarsSwap;
  let nft: MockERC721;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  let aliceToken: bigint;
  let bobToken: bigint;

  beforeEach(async function () {
    [alice, bob, charlie] = await ethers.getSigners();

    const MockERC721 = await ethers.getContractFactory("MockERC721");
    nft = await MockERC721.deploy("Gnars", "GNAR");

    const GnarsSwap = await ethers.getContractFactory("GnarsSwap");
    swap = await GnarsSwap.deploy(await nft.getAddress());

    // Mint tokens
    aliceToken = (await nft.connect(alice).mint.staticCall(alice.address));
    await nft.connect(alice).mint(alice.address);

    bobToken = (await nft.connect(bob).mint.staticCall(bob.address));
    await nft.connect(bob).mint(bob.address);

    // Approve swap contract
    await nft.connect(alice).approve(await swap.getAddress(), aliceToken);
    await nft.connect(bob).approve(await swap.getAddress(), bobToken);
  });

  describe("proposeSwap", function () {
    it("creates a swap and escrows the NFT", async function () {
      const tx = await swap
        .connect(alice)
        .proposeSwap(aliceToken, bobToken, bob.address);

      await expect(tx)
        .to.emit(swap, "SwapProposed")
        .withArgs(0, alice.address, bob.address, aliceToken, bobToken, 0);

      expect(await nft.ownerOf(aliceToken)).to.equal(await swap.getAddress());

      const s = await swap.getSwap(0);
      expect(s.proposer).to.equal(alice.address);
      expect(s.counterparty).to.equal(bob.address);
      expect(s.status).to.equal(0); // Open
    });

    it("accepts ETH with the proposal", async function () {
      const ethAmount = ethers.parseEther("0.5");
      await swap
        .connect(alice)
        .proposeSwap(aliceToken, bobToken, bob.address, { value: ethAmount });

      const s = await swap.getSwap(0);
      expect(s.ethAmount).to.equal(ethAmount);
      expect(
        await ethers.provider.getBalance(await swap.getAddress())
      ).to.equal(ethAmount);
    });

    it("reverts if not token owner", async function () {
      await expect(
        swap.connect(bob).proposeSwap(aliceToken, bobToken, alice.address)
      ).to.be.revertedWithCustomError(swap, "NotTokenOwner");
    });

    it("reverts if counterparty is self", async function () {
      await expect(
        swap.connect(alice).proposeSwap(aliceToken, bobToken, alice.address)
      ).to.be.revertedWithCustomError(swap, "InvalidCounterparty");
    });

    it("reverts if counterparty is zero address", async function () {
      await expect(
        swap
          .connect(alice)
          .proposeSwap(aliceToken, bobToken, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(swap, "InvalidCounterparty");
    });
  });

  describe("acceptSwap", function () {
    beforeEach(async function () {
      await swap.connect(alice).proposeSwap(aliceToken, bobToken, bob.address);
    });

    it("executes the swap atomically", async function () {
      const tx = await swap.connect(bob).acceptSwap(0);

      await expect(tx).to.emit(swap, "SwapExecuted").withArgs(0);

      expect(await nft.ownerOf(aliceToken)).to.equal(bob.address);
      expect(await nft.ownerOf(bobToken)).to.equal(alice.address);

      const s = await swap.getSwap(0);
      expect(s.status).to.equal(1); // Executed
    });

    it("sends ETH sweetener to counterparty", async function () {
      await nft.connect(alice).mint(alice.address); // token 2
      await nft.connect(alice).approve(await swap.getAddress(), 2);
      await nft.connect(bob).mint(bob.address); // token 3
      await nft.connect(bob).approve(await swap.getAddress(), 3);

      const ethAmount = ethers.parseEther("1");
      await swap
        .connect(alice)
        .proposeSwap(2, 3, bob.address, { value: ethAmount });

      const bobBalBefore = await ethers.provider.getBalance(bob.address);
      const tx = await swap.connect(bob).acceptSwap(1);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const bobBalAfter = await ethers.provider.getBalance(bob.address);

      expect(bobBalAfter - bobBalBefore + gasUsed).to.equal(ethAmount);
    });

    it("reverts if not counterparty", async function () {
      await expect(
        swap.connect(charlie).acceptSwap(0)
      ).to.be.revertedWithCustomError(swap, "OnlyCounterparty");
    });

    it("reverts if swap not open", async function () {
      await swap.connect(bob).acceptSwap(0);
      await expect(
        swap.connect(bob).acceptSwap(0)
      ).to.be.revertedWithCustomError(swap, "SwapNotOpen");
    });

    it("reverts if counterparty no longer owns the wanted token", async function () {
      await nft.connect(bob).transferFrom(bob.address, charlie.address, bobToken);

      await expect(
        swap.connect(bob).acceptSwap(0)
      ).to.be.revertedWithCustomError(swap, "NotTokenOwner");
    });
  });

  describe("cancelSwap", function () {
    beforeEach(async function () {
      const ethAmount = ethers.parseEther("0.1");
      await swap
        .connect(alice)
        .proposeSwap(aliceToken, bobToken, bob.address, { value: ethAmount });
    });

    it("returns NFT and ETH to proposer", async function () {
      const aliceBalBefore = await ethers.provider.getBalance(alice.address);
      const tx = await swap.connect(alice).cancelSwap(0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const aliceBalAfter = await ethers.provider.getBalance(alice.address);

      expect(await nft.ownerOf(aliceToken)).to.equal(alice.address);

      const ethReturned = aliceBalAfter - aliceBalBefore + gasUsed;
      expect(ethReturned).to.equal(ethers.parseEther("0.1"));

      const s = await swap.getSwap(0);
      expect(s.status).to.equal(2); // Cancelled
    });

    it("reverts if not proposer", async function () {
      await expect(
        swap.connect(bob).cancelSwap(0)
      ).to.be.revertedWithCustomError(swap, "OnlyProposer");
    });

    it("reverts if swap not open", async function () {
      await swap.connect(alice).cancelSwap(0);
      await expect(
        swap.connect(alice).cancelSwap(0)
      ).to.be.revertedWithCustomError(swap, "SwapNotOpen");
    });
  });
});
