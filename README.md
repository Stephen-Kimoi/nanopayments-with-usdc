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

1. Client makes a request to the LLM endpoint
2. Server returns `402 Payment Required` with Circle `GatewayWalletBatched` payment requirements
3. Client signs an EIP-3009 `TransferWithAuthorization` message offchain (no gas cost)
4. Client retries with the signed payload in the `PAYMENT-SIGNATURE` header
5. Server calls Circle's Gateway API to settle the payment
6. On success, server forwards the request to OpenAI and returns the response

Circle aggregates signed authorizations and settles them in batches onchain, making sub-cent payments practical.

---

## Stack

- **[Circle Gateway Nano Payments](https://developers.circle.com/gateway/nanopayments)** — gasless USDC micropayments via batched settlement
- **[x402 protocol](https://developers.circle.com/gateway/nanopayments/concepts/x402)** — HTTP-native payment negotiation using the `402 Payment Required` status code
- **[@circle-fin/x402-batching](https://www.npmjs.com/package/@circle-fin/x402-batching)** — Circle's SDK for both server-side middleware and client-side payment
- **Express** — server framework
- **OpenAI SDK** — LLM inference (any OpenAI-compatible endpoint works)
- **Network** — Base Sepolia testnet

---

## Project structure

```
├── server/
│   └── index.ts       # Express server with Circle Gateway payment middleware
├── client/
│   ├── pay.ts         # Buyer client — automatic x402 payment flow
│   └── deposit.ts     # One-time USDC deposit into Circle Gateway Wallet
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- Node.js v18+
- Two Base Sepolia wallets: one for the seller (receives USDC), one for the buyer (funds payments)
- Testnet USDC for the buyer wallet — get it at [faucet.circle.com](https://faucet.circle.com)
- Testnet ETH for gas on Base Sepolia — get it at [alchemy.com/faucets/base-sepolia](https://www.alchemy.com/faucets/base-sepolia)
- An OpenAI API key (or any OpenAI-compatible endpoint)

---

## Setup

**1. Clone and install**

```bash
git clone https://github.com/Stephen-Kimoi/nanopayments-with-usdc.git
cd nanopayments-with-usdc
npm install
```

**2. Configure environment**

```bash
cp .env.example .env
```

Fill in `.env`:

```env
# Seller — wallet address that receives USDC
EVM_ADDRESS=0xYourSellerWalletAddress

# LLM backend
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Buyer — private key of the wallet funding inference calls
PRIVATE_KEY=0xYourBuyerPrivateKey

# Server URL (for the client)
RESOURCE_SERVER_URL=http://localhost:4021
```

**3. Deposit USDC into the Gateway Wallet (buyer, one-time)**

```bash
npm run deposit          # deposits 1 USDC
npm run deposit -- 0.5  # deposits 0.5 USDC
```

This runs two transactions: `approve` and `deposit` into Circle's Gateway Wallet contract. Base Sepolia deposits take ~13-19 minutes to confirm onchain.

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
Price per call : $0.001 USDC (Base Sepolia)
```

**Terminal 2 — make a paid inference call**

```bash
npm run client
```

```
Gateway balance : 1.000000 USDC
Calling : POST http://localhost:4021/chat

Payment required: $0.001000 USDC (GatewayWalletBatched)
Network          : eip155:84532

Status : 200
Reply  : Circle USDC nano payments are...
Model  : gpt-4o-mini
```

---

## Reference

- [Nano Payments overview](https://developers.circle.com/gateway/nanopayments)
- [x402 concept](https://developers.circle.com/gateway/nanopayments/concepts/x402)
- [Batched settlement](https://developers.circle.com/gateway/nanopayments/concepts/batched-settlement)
- [Seller quickstart](https://developers.circle.com/gateway/nanopayments/quickstarts/seller)
- [Buyer quickstart](https://developers.circle.com/gateway/nanopayments/quickstarts/buyer)
- [x402 seller integration](https://developers.circle.com/gateway/nanopayments/howtos/x402-seller)
- [x402 buyer integration](https://developers.circle.com/gateway/nanopayments/howtos/x402-buyer)
- [EIP-3009 signing](https://developers.circle.com/gateway/nanopayments/howtos/eip-3009-signing)
- [Supported networks](https://developers.circle.com/gateway/nanopayments/supported-networks)
- [SDK reference](https://developers.circle.com/gateway/nanopayments/references/sdk)
