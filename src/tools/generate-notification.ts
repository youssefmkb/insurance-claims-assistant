import { anthropic, MODELS } from "../utils/anthropic-client.js";
import { log } from "../utils/logger.js";
import type { SendProgressFn } from "../utils/progress.js";
import type { ClaimData, ClassificationResult, NotificationPayload } from "../types/claim.types.js";

export const generateNotificationTool = {
  name: "generate_broker_notification",
  description:
    "Génère une notification courtier formelle suite à la classification d'un sinistre automobile. Inclut les détails du sinistre, la décision de traitement et les actions requises.",
  inputSchema: {
    type: "object",
    properties: {
      claimData: {
        type: "object",
        description: "Objet ClaimData retourné par analyze_claim_report",
      },
      classification: {
        type: "object",
        description: "Objet ClassificationResult retourné par classify_claim_severity",
      },
    },
    required: ["claimData", "classification"],
  },
};

export async function generateBrokerNotification(
  claimData: ClaimData,
  classification: ClassificationResult,
  sendProgressFn?: SendProgressFn
): Promise<string> {
  log("info", "generate-notification", "Début génération notification", {
    claimId: claimData.claimId,
    severity: classification.severity,
  });

  // Progress 1 : analyse des données
  if (sendProgressFn) {
    await sendProgressFn(1, 3, "Analyse des données sinistre...");
  }

  const payload: NotificationPayload = {
    claimData,
    classification,
    generatedAt: new Date().toISOString(),
  };

  const notificationPrompt = `
<role>
Tu es un système de gestion de sinistres automobiles d'une compagnie d'assurance française.
Tu rédiges des notifications formelles à destination des courtiers partenaires.
</role>

<task>
Génère une notification courtier professionnelle et formelle basée sur les données du sinistre.
La notification doit être claire, structurée et actionnable.
</task>

<sinistre>
Référence : ${payload.claimData.claimId}
Date : ${payload.claimData.reportDate}
Circonstances : ${payload.claimData.circumstances}
Parties : ${payload.claimData.parties.map((p) => `${p.name} (${p.role})`).join(", ")}
Blessés : ${payload.claimData.parties.some((p) => p.injuries) ? "OUI" : "NON"}
Dommages : ${payload.claimData.damages.map((d) => `${d.target} - ${d.severity}`).join(", ")}
</sinistre>

<decision>
Classification : ${payload.classification.severity}
Décision juge : ${payload.classification.judgeVerdict.approved ? "Validée" : "Corrigée"}
Feedback : ${payload.classification.judgeVerdict.feedback}
</decision>

<format_notification>
Objet : [Référence sinistre] - [Classification]
Date : [date génération]

Madame, Monsieur,

[Paragraphe 1 : rappel des faits du sinistre]

[Paragraphe 2 : décision de traitement et justification]

[Paragraphe 3 : actions requises selon la classification]
- AUTO_PROCESS → traitement automatique, aucune action requise
- REVIEW_NEEDED → merci de transmettre les pièces complémentaires sous 48h
- URGENT_ESCALATION → intervention immédiate requise, contact gestionnaire dédié

Cordialement,
Service Gestion Sinistres Automobiles
</format_notification>

<constraints>
- Ton formel et professionnel
- Français impeccable
- Actions concrètes et claires
- Maximum 250 mots
</constraints>
`;

  // Progress 2 : génération en cours
  if (sendProgressFn) {
    await sendProgressFn(2, 3, "Rédaction de la notification...");
  }

  const response = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 512,
    messages: [{ role: "user", content: notificationPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Réponse inattendue de l'API");
  }

  // Progress 3 : terminé
  if (sendProgressFn) {
    await sendProgressFn(3, 3, "Notification générée.");
  }

  log("info", "generate-notification", "Notification générée", {
    claimId: claimData.claimId,
    length: content.text.length,
  });

  return content.text;
}