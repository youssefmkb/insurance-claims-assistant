/*
---
name: claim-extraction
description: Extrait les entités structurées d'un constat de sinistre automobile
input_schema:
  rawText: string
  claimId: string
---
*/

export interface ClaimExtractionInput {
  rawText: string;
  claimId: string;
}

export function buildClaimExtractionPrompt(input: ClaimExtractionInput): string {
  return `
<role>
Tu es un expert en analyse de sinistres automobiles pour une compagnie d'assurance française.
Tu analyses des constats amiables et rapports de sinistres avec précision et rigueur.
</role>

<task>
Extrais toutes les informations structurées du constat de sinistre suivant.
Retourne UNIQUEMENT un objet JSON valide, sans texte autour, sans markdown.
</task>

<input>
Identifiant sinistre : ${input.claimId}
Texte du constat :
${input.rawText}
</input>

<output_format>
{
  "claimId": "${input.claimId}",
  "reportDate": "YYYY-MM-DD",
  "vehicles": [
    {
      "licensePlate": "string",
      "make": "string",
      "model": "string",
      "insurancePolicy": "string"
    }
  ],
  "parties": [
    {
      "role": "responsible | victim | unknown",
      "name": "string",
      "contact": "string",
      "injuries": true | false
    }
  ],
  "damages": [
    {
      "target": "vehicle | property | person",
      "description": "string",
      "severity": "minor | moderate | severe"
    }
  ],
  "circumstances": "description des circonstances en une phrase",
  "witnesses": ["nom et contact si disponible"],
  "rawText": "${input.rawText.replace(/"/g, '\\"')}"
}
</output_format>

<constraints>
- Si une information est absente, utilise une chaîne vide "" ou un tableau vide []
- Ne jamais inventer d'informations non présentes dans le texte
- Le champ rawText doit contenir le texte original tel quel
- injuries = true uniquement si blessures explicitement mentionnées
</constraints>
`;
}