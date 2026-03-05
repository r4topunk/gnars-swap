export const GNARS_SWAP_ADDRESS = {
  [84532]: "0x78CD86E78B2fEa4919a8805B8FFe09E3BD1dbfA2", // Base Sepolia
} as Record<number, `0x${string}`>;

export const GNARS_NFT_ADDRESS = {
  [84532]: "0xcaBa79dFa3887705bF1A7A880DEe0888470CBF53", // Base Sepolia (MockERC721)
} as Record<number, `0x${string}`>;

export const GNARS_SWAP_ABI = [
  {
    inputs: [{ name: "_gnarsNFT", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "InvalidCounterparty", type: "error" },
  { inputs: [], name: "NotTokenOwner", type: "error" },
  { inputs: [], name: "OnlyCounterparty", type: "error" },
  { inputs: [], name: "OnlyProposer", type: "error" },
  { inputs: [], name: "SwapNotOpen", type: "error" },
  { inputs: [], name: "TransferFailed", type: "error" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "swapId", type: "uint256" },
    ],
    name: "SwapCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "swapId", type: "uint256" },
    ],
    name: "SwapExecuted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "swapId", type: "uint256" },
      { indexed: true, name: "proposer", type: "address" },
      { indexed: true, name: "counterparty", type: "address" },
      { indexed: false, name: "tokenIdOffered", type: "uint256" },
      { indexed: false, name: "tokenIdWanted", type: "uint256" },
      { indexed: false, name: "ethAmount", type: "uint256" },
    ],
    name: "SwapProposed",
    type: "event",
  },
  {
    inputs: [{ name: "swapId", type: "uint256" }],
    name: "acceptSwap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "swapId", type: "uint256" }],
    name: "cancelSwap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "swapId", type: "uint256" }],
    name: "getSwap",
    outputs: [
      {
        components: [
          { name: "proposer", type: "address" },
          { name: "counterparty", type: "address" },
          { name: "tokenIdOffered", type: "uint256" },
          { name: "tokenIdWanted", type: "uint256" },
          { name: "ethAmount", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "gnarsNFT",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextSwapId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "tokenIdOffered", type: "uint256" },
      { name: "tokenIdWanted", type: "uint256" },
      { name: "counterparty", type: "address" },
    ],
    name: "proposeSwap",
    outputs: [{ name: "swapId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export const ERC721_ABI = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    name: "isApprovedForAll",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getApproved",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
