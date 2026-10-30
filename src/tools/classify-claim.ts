import { anthropic, MODELS, assertNotTruncated } from "../utils/anthropic-client.js";
import { log } from "../utils/logger.js";
import { runClassificationJudge } from "../judge/classification-judge.js";
import type {
  ClaimData,
  ClaimSeverity,
  ClassificationResult,
} from "../types/claim.types.js";

export const classifyClaimTool = {
  name: "classify_claim_severity",
  description:
    "Classifie la sévérité d'un sinistre automobile en AUTO_PROCESS, REVIEW_NEEDED ou URGENT_ESCALATION. Utilise un LLM-as-judge (Sonnet valide Haiku) pour garantir la fiabilité.",
  inputSchema: {
    type: "object",
    properties: {
      claimData: {
        type: "object",
        description: "Objet ClaimData retourné par analyze_claim_report",
      },
    },
    required: ["claimData"],
  },
};

export async function classifyClaimSeverity(
  claimData: ClaimData,
): Promise<ClassificationResult> {
  log("info", "classify-claim", "Début classification", {
    claimId: claimData.claimId,
  });

  // Étape 1 : Haiku classifie
  const haikusPrompt = `
<role>
Tu es un système de triage automatique de sinistres automobiles.
</role>

<task>
Analyse ce sinistre et classifie-le. Retourne UNIQUEMENT un JSON valide.
</task>

<claim>
Parties : ${claimData.parties.length} impliquées
Blessés : ${claimData.parties.some((p) => p.injuries) ? "OUI" : "NON"}
Dommages : ${claimData.damages.map((d) => `${d.target} - ${d.severity}`).join(", ")}
Circonstances : ${claimData.circumstances}
</claim>

<classification_rules>
- AUTO_PROCESS : dommages mineurs, aucun blessé, circonstances claires et non contestées
- REVIEW_NEEDED : dommages modérés OU circonstances ambiguës OU versions contradictoires entre les parties OU incertitude
- URGENT_ESCALATION : blessés confirmés OU dommages sévères OU indices de fraude (dégâts incohérents avec le récit, déclarations qui changent, témoin lié à une partie)
- Un désaccord entre les parties, sans blessé, sans dommage sévère et sans indice de fraude, relève de REVIEW_NEEDED et jamais de URGENT_ESCALATION
</classification_rules>

<output_format>
{
  "severity": "AUTO_PROCESS | REVIEW_NEEDED | URGENT_ESCALATION",
  "confidence": 0.0,
  "reasoning": "explication courte"
}
</output_format>
`;

  const haikuResponse = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 512,
    messages: [{ role: "user", content: haikusPrompt }],
  });

  assertNotTruncated(haikuResponse, "classify-claim");

  const haikuContent = haikuResponse.content[0];
  if (haikuContent.type !== "text") {
    throw new Error("Réponse inattendue de Haiku");
  }

  let haikuResult: { severity: ClaimSeverity; confidence: number; reasoning: string };
try {
  const cleaned = haikuContent.text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  haikuResult = JSON.parse(cleaned);
} catch {
  log("error", "classify-claim", "Échec parsing Haiku", {
    raw: haikuContent.text,
  });
  throw new Error(`Impossible de parser la classification Haiku : ${haikuContent.text}`);
}

  log("info", "classify-claim", "Classification Haiku", {
    severity: haikuResult.severity,
    confidence: haikuResult.confidence,
  });

  // Étape 2 : Sonnet juge
  const judgeVerdict = await runClassificationJudge(
    claimData,
    haikuResult.severity,
    haikuResult.reasoning,
    haikuResult.confidence,
  );

  const result: ClassificationResult = {
    severity: judgeVerdict.finalSeverity,
    initialSeverity: haikuResult.severity,
    confidence: haikuResult.confidence,
    reasoning: haikuResult.reasoning,
    judgeVerdict,
  };

  log("info", "classify-claim", "Classification finale", {
    claimId: claimData.claimId,
    finalSeverity: result.severity,
    approved: judgeVerdict.approved,
  });

  return result;
}
