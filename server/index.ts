import express from "express";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";

const app = express();
app.use(express.json());

// ── Config ───────────────────────────────────────────────────
const SELLER_ADDRESS = process.env.EVM_ADDRESS as `0x${string}`;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!SELLER_ADDRESS) throw new Error("EVM_ADDRESS is required — copy .env.example to .env");
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");

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
