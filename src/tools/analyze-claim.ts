import { anthropic, MODELS } from "../utils/anthropic-client.js";
import { log } from "../utils/logger.js";
import { buildClaimExtractionPrompt } from "../skills/claim-extraction.skill.js";
import type { ClaimData } from "../types/claim.types.js";

export const analyzeClaimTool = {
  name: "analyze_claim_report",
  description:
    "Extrait les entités structurées d'un constat de sinistre automobile : véhicules, parties, dommages et circonstances. Retourne un objet ClaimData structuré.",
  inputSchema: {
    type: "object",
    properties: {
      rawText: {
        type: "string",
        description: "Texte brut du constat amiable ou rapport de sinistre",
      },
      claimId: {
        type: "string",
        description: "Identifiant unique du sinistre (ex: CLM-2024-001)",
      },
    },
    required: ["rawText", "claimId"],
  },
};

export async function analyzeClaimReport(
  rawText: string,
  claimId: string,
): Promise<ClaimData> {
  log("info", "analyze-claim", `Début analyse sinistre`, { claimId });

  const prompt = buildClaimExtractionPrompt({ rawText, claimId });

  log("debug", "analyze-claim", "Appel Haiku en cours...");

  const response = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Réponse inattendue de l'API : type non-text");
  }

  let claimData: ClaimData;
  try {
    const cleaned = content.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    claimData = JSON.parse(cleaned) as ClaimData;
  } catch {
    log("error", "analyze-claim", "Échec parsing JSON", { raw: content.text });
    throw new Error(`Impossible de parser la réponse JSON : ${content.text}`);
  }

  return claimData;
}
