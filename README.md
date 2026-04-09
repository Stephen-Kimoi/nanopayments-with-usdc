# Nanopayments with USDC

Charge per LLM call in USDC using Circle's Gateway Nano Payments and the x402 protocol. No subscriptions, no invoices — buyers pay per inference request with a gasless offchain signature, and Circle batches the settlements onchain.

Built for the [Arc Hackathon 3rd Edition](https://lablab.ai/event/agentic-economy-on-arc).

---

## How it works

```
Buyer                          Server                        Circle Gateway
  |                               |                                |
  |── POST /chat ────────────────>|                                |
  |<── 402 + payment requirements-|                                |
  |                               |                                |
  |  (sign EIP-3009 offchain,     |                                |
  |   zero gas)                   |                                |
  |                               |                                |
  |── POST /chat ─────────────────|                                |
  |   PAYMENT-SIGNATURE: <sig>    |── POST /v1/x402/settle ───────>|
  |                               |<── { success: true } ──────────|
  |<── 200 + LLM response ────────|                                |
```

1. Client requests the LLM endpoint
2. Server returns `402 Payment Required` with `GatewayWalletBatched` payment requirements
3. Client signs an EIP-3009 `TransferWithAuthorization` message offchain (zero gas)
4. Client retries with the signed payload in the `PAYMENT-SIGNATURE` header
5. Server calls Circle's Gateway API to settle the payment
6. On success, server calls OpenAI and returns the LLM response

Circle aggregates signed authorizations and settles them in batches onchain, making sub-cent payments practical.

---

## Stack

- **[Circle Gateway Nano Payments](https://developers.circle.com/gateway/nanopayments)** — gasless USDC micropayments via batched settlement
- **[x402 protocol](https://developers.circle.com/gateway/nanopayments/concepts/x402)** — HTTP-native payment negotiation using the `402 Payment Required` status code
- **[@circle-fin/x402-batching](https://www.npmjs.com/package/@circle-fin/x402-batching)** — Circle's official SDK for server middleware and client payment
- **Express** — server framework
- **OpenAI SDK** — LLM inference (any OpenAI-compatible endpoint works)
- **React + TypeScript + Vite** — demo UI
- **Network** — Base Sepolia testnet (`eip155:84532`)
- **Price per call** — $0.01 USDC

---

## Project structure

```
├── server/
│   └── index.ts          # Express seller + embedded GatewayClient for /demo/* routes
├── client/
│   ├── pay.ts            # Standalone buyer client — automatic x402 payment flow
│   ├── deposit.ts        # One-time USDC deposit into Circle Gateway Wallet
│   └── check-balance.ts  # Poll Gateway balance until deposit is credited
├── ui/
│   ├── src/
│   │   ├── App.tsx       # React demo UI with animated 5-step payment pipeline
│   │   └── index.css     # Tailwind + custom animations
│   └── vite.config.ts    # Proxies /demo/* to Express server on port 4021
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- Node.js v18+
- Two Base Sepolia wallets: one for the seller (receives USDC), one for the buyer (funds payments)
- Testnet USDC for the buyer wallet — [faucet.circle.com](https://faucet.circle.com)
- Testnet ETH for gas on Base Sepolia — [alchemy.com/faucets/base-sepolia](https://www.alchemy.com/faucets/base-sepolia)
- An OpenAI API key (or any OpenAI-compatible endpoint)

---

## Setup

**1. Clone and install**

```bash
git clone https://github.com/Stephen-Kimoi/nanopayments-with-usdc.git
cd nanopayments-with-usdc
npm install
cd ui && npm install && cd ..
```

**2. Configure environment**

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Seller — wallet address that receives $0.01 USDC per call
EVM_ADDRESS=0xYourSellerWalletAddress

# Buyer — private key of the wallet funding inference calls
# Also used by the server's embedded GatewayClient for the demo UI
EVM_PRIVATE_KEY=0xYourBuyerPrivateKey

# LLM backend
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Server URL (for the standalone client)
RESOURCE_SERVER_URL=http://localhost:4021
```

**3. Deposit USDC into the Gateway Wallet (buyer, one-time)**

```bash
npm run deposit -- 0.10
```

This runs two transactions: `approve` and `deposit` into Circle's Gateway Wallet contract (`0x0077777d7EBA4688BDeF3E311b846F25870A19B9`). Base Sepolia deposits take ~13–19 minutes for Circle to credit.

Poll until the balance appears:

```bash
npm run balance
```

---

## Running

**Terminal 1 — start the server**

```bash
npm run server
```

```
Server running at http://localhost:4021
Seller address : 0x...
Model          : gpt-4o-mini
Price per call : $0.01 USDC (Base Sepolia)
```

**Terminal 2 — demo UI**

```bash
npm run ui
```

Open `http://localhost:5173`. The UI calls `/demo/balance` and `/demo/chat` — the server acts as the buyer internally, so no private keys touch the browser. Each message triggers a full x402 payment cycle and shows the animated 5-step pipeline + receipt.

**Terminal 2 (alternative) — make a paid call from the terminal**

```bash
npm run client
```

```
Gateway balance : 0.09 USDC
Calling : POST http://localhost:4021/chat

Status : 200
Reply  : Circle USDC nano payments are...
Model  : gpt-4o-mini

Gateway balance after : 0.08 USDC
```

---

## Scripts

| Script | What it does |
|---|---|
| `npm run server` | Start Express server on port 4021 |
| `npm run ui` | Start Vite dev server on port 5173 |
| `npm run client` | Make one paid inference call from the terminal |
| `npm run deposit -- <amount>` | Deposit USDC into Circle Gateway Wallet |
| `npm run balance` | Poll Gateway balance every 60s |

---

## Reference

- [Nano Payments overview](https://developers.circle.com/gateway/nanopayments)
- [x402 concept](https://developers.circle.com/gateway/nanopayments/concepts/x402)
- [Batched settlement](https://developers.circle.com/gateway/nanopayments/concepts/batched-settlement)
- [Seller quickstart](https://developers.circle.com/gateway/nanopayments/quickstarts/seller)
- [Buyer quickstart](https://developers.circle.com/gateway/nanopayments/quickstarts/buyer)
- [EIP-3009 signing](https://developers.circle.com/gateway/nanopayments/howtos/eip-3009-signing)
- [Supported networks](https://developers.circle.com/gateway/nanopayments/supported-networks)
- [SDK reference](https://developers.circle.com/gateway/nanopayments/references/sdk)
