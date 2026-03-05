// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GnarsSwap
/// @notice P2P NFT swap contract scoped to a single ERC-721 collection (Gnars).
///         Proposer offers their token (+ optional ETH) for a specific counterparty token.
///         Counterparty accepts or proposer cancels.
contract GnarsSwap is ReentrancyGuard {
    // -----------------------------------------------------------------------
    // Types
    // -----------------------------------------------------------------------

    enum Status {
        Open,
        Executed,
        Cancelled
    }

    struct Swap {
        address proposer;
        address counterparty;
        uint256 tokenIdOffered;
        uint256 tokenIdWanted;
        uint256 ethAmount;
        Status status;
    }

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    IERC721 public immutable gnarsNFT;

    uint256 public nextSwapId;
    mapping(uint256 => Swap) public swaps;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event SwapProposed(
        uint256 indexed swapId,
        address indexed proposer,
        address indexed counterparty,
        uint256 tokenIdOffered,
        uint256 tokenIdWanted,
        uint256 ethAmount
    );

    event SwapExecuted(uint256 indexed swapId);
    event SwapCancelled(uint256 indexed swapId);

    // -----------------------------------------------------------------------
    // Errors
    // -----------------------------------------------------------------------

    error NotTokenOwner();
    error InvalidCounterparty();
    error SwapNotOpen();
    error OnlyProposer();
    error OnlyCounterparty();
    error TransferFailed();

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    constructor(address _gnarsNFT) {
        gnarsNFT = IERC721(_gnarsNFT);
    }

    // -----------------------------------------------------------------------
    // Core
    // -----------------------------------------------------------------------

    /// @notice Propose a swap: deposit your NFT (+ optional ETH) and specify
    ///         which counterparty token you want.
    /// @param tokenIdOffered  Your Gnars token to offer.
    /// @param tokenIdWanted   The counterparty's Gnars token you want.
    /// @param counterparty    Address that owns tokenIdWanted.
    function proposeSwap(
        uint256 tokenIdOffered,
        uint256 tokenIdWanted,
        address counterparty
    ) external payable nonReentrant returns (uint256 swapId) {
        if (counterparty == address(0) || counterparty == msg.sender)
            revert InvalidCounterparty();
        if (gnarsNFT.ownerOf(tokenIdOffered) != msg.sender)
            revert NotTokenOwner();

        swapId = nextSwapId++;
        swaps[swapId] = Swap({
            proposer: msg.sender,
            counterparty: counterparty,
            tokenIdOffered: tokenIdOffered,
            tokenIdWanted: tokenIdWanted,
            ethAmount: msg.value,
            status: Status.Open
        });

        // Escrow proposer's NFT
        gnarsNFT.transferFrom(msg.sender, address(this), tokenIdOffered);

        emit SwapProposed(
            swapId,
            msg.sender,
            counterparty,
            tokenIdOffered,
            tokenIdWanted,
            msg.value
        );
    }

    /// @notice Counterparty accepts the swap. Atomic exchange happens.
    function acceptSwap(uint256 swapId) external nonReentrant {
        Swap storage s = swaps[swapId];
        if (s.status != Status.Open) revert SwapNotOpen();
        if (msg.sender != s.counterparty) revert OnlyCounterparty();
        if (gnarsNFT.ownerOf(s.tokenIdWanted) != msg.sender)
            revert NotTokenOwner();

        s.status = Status.Executed;

        // Counterparty sends their NFT to proposer
        gnarsNFT.transferFrom(msg.sender, s.proposer, s.tokenIdWanted);

        // Proposer's escrowed NFT goes to counterparty
        gnarsNFT.transferFrom(address(this), s.counterparty, s.tokenIdOffered);

        // Send ETH sweetener to counterparty
        if (s.ethAmount > 0) {
            (bool ok, ) = s.counterparty.call{value: s.ethAmount}("");
            if (!ok) revert TransferFailed();
        }

        emit SwapExecuted(swapId);
    }

    /// @notice Proposer cancels and recovers NFT + ETH.
    function cancelSwap(uint256 swapId) external nonReentrant {
        Swap storage s = swaps[swapId];
        if (s.status != Status.Open) revert SwapNotOpen();
        if (msg.sender != s.proposer) revert OnlyProposer();

        s.status = Status.Cancelled;

        // Return NFT
        gnarsNFT.transferFrom(address(this), s.proposer, s.tokenIdOffered);

        // Return ETH
        if (s.ethAmount > 0) {
            (bool ok, ) = s.proposer.call{value: s.ethAmount}("");
            if (!ok) revert TransferFailed();
        }

        emit SwapCancelled(swapId);
    }

    // -----------------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------------

    function getSwap(uint256 swapId) external view returns (Swap memory) {
        return swaps[swapId];
    }
}
