# GnarsSwap

P2P NFT swap contract for [Gnars](https://gnars.com) on Base.

Proposer offers their Gnars token (+ optional ETH sweetener) for a specific counterparty token. Counterparty accepts or proposer cancels. Atomic exchange via escrow.

## Gnars Base Contracts

| Contract | Address |
|----------|---------|
| Gnars NFT (ERC-721) | `0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17` |
| Auction | `0x494eaa55ecf6310658b8fc004b0888dcb698097f` |
| Governor | `0x3dd4e53a232b7b715c9ae455f4e732465ed71b4c` |
| Treasury | `0x72ad986ebac0246d2b3c565ab2a1ce3a14ce6f88` |

## Setup

```bash
npm install
cp .env.example .env
# Fill in your keys
```

## Commands

```bash
npm run compile          # Compile contracts
npm test                 # Run tests
npm run test:coverage    # Coverage report
npm run deploy:base-sepolia  # Deploy to Base Sepolia (uses MockERC721 if no GNARS_NFT_ADDRESS)
npm run deploy:base          # Deploy to Base mainnet
```

## Contract

**GnarsSwap.sol** — scoped to a single ERC-721 collection (Gnars).

- `proposeSwap(tokenIdOffered, tokenIdWanted, counterparty)` — escrow your NFT + optional ETH
- `acceptSwap(swapId)` — counterparty accepts, atomic exchange
- `cancelSwap(swapId)` — proposer recovers NFT + ETH

## Frontend

Next.js app in `frontend/` using wagmi + viem.

```bash
cd frontend
pnpm install
pnpm dev
```

## License

MIT
