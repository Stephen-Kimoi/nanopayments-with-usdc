import express from "express";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const app = express();
app.use(express.json());

// ── Config ───────────────────────────────────────────────────
const SELLER_ADDRESS = process.env.EVM_ADDRESS as `0x${string}`;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const SERVER_URL = `http://localhost:4021`;

if (!SELLER_ADDRESS) throw new Error("EVM_ADDRESS is required — copy .env.example to .env");
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");

// ── Buyer client (embedded, for /demo/* endpoints) ───────────
// The UI never touches private keys — the server acts as buyer internally.
const rawKey = process.env.PRIVATE_KEY || process.env.EVM_PRIVATE_KEY || "";
const buyerClient = rawKey
  ? new GatewayClient({
      chain: "baseSepolia",
      privateKey: (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`,
    })
  : null;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Circle Gateway middleware ─────────────────────────────────
// createGatewayMiddleware handles the full x402 flow:
//   - returns 402 + GatewayWalletBatched payment requirements on unpaid requests
//   - settles signed EIP-3009 authorizations with Circle's Gateway API
//   - populates req.payment with payer info on success
const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  networks: ["eip155:84532"],  // Base Sepolia
});

// ── Demo routes (used by UI) ──────────────────────────────────
// GET /demo/balance — returns live Gateway + wallet balances
app.get("/demo/balance", async (_req, res) => {
  if (!buyerClient) {
    res.status(503).json({ error: "No buyer private key configured" });
    return;
  }
  try {
    const b = await buyerClient.getBalances();
    res.json({
      gateway: b.gateway.formattedAvailable,
      wallet: b.wallet.formatted,
    });
  } catch (err) {
    console.error("Balance fetch error:", err);
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

// POST /demo/chat — buyer pays internally, UI gets reply + payment receipt
app.post("/demo/chat", async (req, res) => {
  if (!buyerClient) {
    res.status(503).json({ error: "No buyer private key configured" });
    return;
  }
  try {
    const { messages } = req.body as { messages: { role: string; content: string }[] };

    // Snapshot balance before the payment
    const before = await buyerClient.getBalances();
    const balanceBefore = before.gateway.formattedAvailable;

    // GatewayClient.pay() handles the full x402 flow:
    //   sends request → receives 402 → signs EIP-3009 offchain → retries → gets response
    const { data } = await buyerClient.pay<{
      reply: string;
      model: string;
      usage: Record<string, number>;
    }>(`${SERVER_URL}/chat`, {
      method: "POST",
      body: JSON.stringify({ messages }),
      headers: { "Content-Type": "application/json" },
    });

    // Snapshot balance after
    const after = await buyerClient.getBalances();
    const balanceAfter = after.gateway.formattedAvailable;

    res.json({
      reply: data.reply,
      model: data.model,
      usage: data.usage,
      payment: {
        amount: "0.01",
        currency: "USDC",
        network: "Base Sepolia",
        scheme: "GatewayWalletBatched",
        balanceBefore,
        balanceAfter,
      },
    });
  } catch (err) {
    console.error("Demo chat error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ── Routes ───────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    model: MODEL,
    price: "$0.01 USDC per call",
    network: "Base Sepolia (eip155:84532)",
    sellerAddress: SELLER_ADDRESS,
  });
});

app.post("/chat", gateway.require("$0.01"), async (req, res) => {
  const { payer, amount, network } = (req as any).payment!;
  console.log(`Payment received: ${amount} USDC from ${payer} on ${network}`);

  try {
    const { messages, model } = req.body as {
      messages: ChatCompletionMessageParam[];
      model?: string;
    };

    const completion = await openai.chat.completions.create({
      model: model || MODEL,
      messages,
    });

    res.json({
      reply: completion.choices[0].message.content,
      model: completion.model,
      usage: completion.usage,
    });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "LLM inference failed" });
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(4021, () => {
  console.log("Server running at http://localhost:4021");
  console.log(`Seller address : ${SELLER_ADDRESS}`);
  console.log(`Model          : ${MODEL}`);
  console.log(`Price per call : $0.01 USDC (Base Sepolia)`);
});
