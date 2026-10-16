// scripts/test-progress.mjs
//
// Appelle generate_broker_notification et affiche les progress notifications reçues.
// Usage : npm run build puis npm run test:progress
// Coût : un appel Haiku (environ 1 centime).

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const claimData = {
  claimId: "CLM-TEST-001",
  reportDate: "2026-10-12",
  vehicles: [
    { licensePlate: "AB-123-CD", make: "Peugeot", model: "208", insurancePolicy: "AXA-998" },
    { licensePlate: "EF-456-GH", make: "Renault", model: "Clio", insurancePolicy: "MAIF-221" },
  ],
  parties: [
    { role: "responsible", name: "", contact: "", injuries: false },
    { role: "victim", name: "", contact: "", injuries: false },
  ],
  damages: [
    { target: "vehicle", description: "Pare-choc arrière enfoncé", severity: "moderate" },
  ],
  circumstances: "Collision arrière à un feu rouge à Lyon.",
  witnesses: [],
  rawText:
    "Le 12/10/2026 à Lyon, le véhicule AB-123-CD a percuté par l'arrière la Clio EF-456-GH à un feu rouge. Pare-choc arrière enfoncé. Aucun blessé.",
};

const classification = {
  severity: "REVIEW_NEEDED",
  confidence: 0.95,
  reasoning: "Dommages modérés, revue humaine requise.",
  judgeVerdict: {
    approved: true,
    feedback: "Classification correcte.",
    finalSeverity: "REVIEW_NEEDED",
  },
};

const client = new Client({ name: "test-progress", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  stderr: "ignore",
});

await client.connect(transport);
console.log("Connecté au serveur, appel de generate_broker_notification...\n");

let received = 0;
const result = await client.callTool(
  { name: "generate_broker_notification", arguments: { claimData, classification } },
  undefined,
  {
    // Fournir onprogress fait envoyer un progressToken par le SDK client.
    onprogress: ({ progress, total, message }) => {
      received++;
      console.log(`  progress ${progress}/${total} : ${message ?? ""}`);
    },
  },
);

console.log(`\nNotifications reçues : ${received}`);
console.log(`isError : ${result.isError ?? false}`);
console.log(`Début de la notification : ${result.content[0].text.slice(0, 150)}...`);

await client.close();
process.exit(received === 3 && !result.isError ? 0 : 1);
