import { anthropic, MODELS } from "../utils/anthropic-client.js";
import { log } from "../utils/logger.js";
import type {
  ClaimData,
  ClaimSeverity,
  JudgeVerdict,
} from "../types/claim.types.js";

export async function runClassificationJudge(
  claimData: ClaimData,
  haikuClassification: ClaimSeverity,
  haikuReasoning: string,
  confidence: number,
): Promise<JudgeVerdict> {
  log("info", "judge", "Sonnet évalue la classification Haiku", {
    claimId: claimData.claimId,
    haikuClassification,
    confidence,
  });

  const judgePrompt = `
<role>
Tu es un expert senior en gestion de sinistres automobiles.
Tu évalues la classification d'un sinistre faite par un système automatisé.
</role>

<task>
Évalue si la classification suivante est correcte et justifiée.
Retourne UNIQUEMENT un objet JSON valide, sans texte autour.
</task>

<claim_data>
Sinistre ID : ${claimData.claimId}
Parties impliquées : ${claimData.parties.length}
Blessés : ${claimData.parties.some((p) => p.injuries) ? "OUI" : "NON"}
Dommages : ${claimData.damages.map((d) => `${d.target} - ${d.severity}`).join(", ")}
Circonstances : ${claimData.circumstances}
</claim_data>

<haiku_classification>
Classification proposée : ${haikuClassification}
Raisonnement : ${haikuReasoning}
Confiance : ${Math.round(confidence * 100)}%
</haiku_classification>

<classification_rules>
- AUTO_PROCESS : dommages mineurs, aucun blessé, circonstances claires et non contestées
- REVIEW_NEEDED : dommages modérés OU circonstances ambiguës OU versions contradictoires entre les parties OU confiance < 70%
- URGENT_ESCALATION : blessés confirmés OU dommages sévères OU indices de fraude (dégâts incohérents avec le récit, déclarations qui changent, témoin lié à une partie)
- Un désaccord entre les parties, sans blessé, sans dommage sévère et sans indice de fraude, relève de REVIEW_NEEDED et jamais de URGENT_ESCALATION
</classification_rules>

<output_format>
{
  "approved": true | false,
  "feedback": "explication courte de la décision",
  "finalSeverity": "AUTO_PROCESS | REVIEW_NEEDED | URGENT_ESCALATION"
}
</output_format>
`;

  const response = await anthropic.messages.create({
    model: MODELS.judge,
    max_tokens: 512,
    messages: [{ role: "user", content: judgePrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Réponse inattendue du judge");
  }

  let verdict: JudgeVerdict;
  try {
    const cleaned = content.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    verdict = JSON.parse(cleaned) as JudgeVerdict;
  } catch {
    log("error", "judge", "Échec parsing verdict", { raw: content.text });
    throw new Error(`Impossible de parser le verdict JSON : ${content.text}`);
  }

  return verdict;
}
