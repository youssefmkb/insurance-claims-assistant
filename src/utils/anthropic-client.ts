import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import { log } from "./logger.js";

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY manquante dans .env");
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODELS = {
  fast: "claude-haiku-4-5",
  judge: "claude-sonnet-4-6",
} as const;

// Une réponse coupée par max_tokens serait incomplète (JSON invalide ou lettre tronquée) : on échoue clairement.
export function assertNotTruncated(response: Anthropic.Message, context: string): void {
  if (response.stop_reason === "max_tokens") {
    log("error", context, "Réponse tronquée par max_tokens", { outputTokens: response.usage.output_tokens });
    throw new Error(`Réponse tronquée par max_tokens (${context})`);
  }
}
