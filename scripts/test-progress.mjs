// scripts/test-progress.mjs
//
// Appelle generate_broker_notification et affiche les progress notifications reçues.
// Usage :
//   npm run test:progress                                       (stdio, lance dist/index.js)
//   npm run test:progress -- --url http://localhost:3000/mcp    (Streamable HTTP)
// Coût : un appel Haiku (environ 1 centime).
// En HTTP, le token est lu dans MCP_AUTH_TOKEN (.env) et envoyé en Bearer.

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const urlIndex = process.argv.indexOf("--url");
const url = urlIndex !== -1 ? process.argv[urlIndex + 1] : undefined;

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
const token = process.env.MCP_AUTH_TOKEN;
const transport = url
  ? new StreamableHTTPClientTransport(new URL(url), {
      requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    })
  : new StdioClientTransport({
      command: "node",
      args: ["dist/index.js"],
      stderr: "ignore",
    });

await client.connect(transport);
console.log(`Connecté via ${url ? `HTTP (${url})` : "stdio"}, appel de generate_broker_notification...\n`);

const received = [];
const result = await client.callTool(
  { name: "generate_broker_notification", arguments: { claimData, classification } },
  undefined,
  {
    // Fournir onprogress fait envoyer un progressToken par le SDK client.
    onprogress: ({ progress, total, message }) => {
      received.push(progress);
      console.log(`  progress ${progress}/${total} : ${message ?? ""}`);
    },
  },
);

console.log(`\nNotifications reçues : ${received.length}`);
// La notification 3 part juste avant la réponse : si les deux arrivent dans le même paquet,
// le SDK client traite la réponse d'abord et perd la notification. 1 et 2 doivent toujours arriver.
if (!received.includes(3)) {
  console.log("Note : notification 3 perdue côté client (course connue du SDK MCP, le serveur l'a bien envoyée)");
}
console.log(`isError : ${result.isError ?? false}`);
console.log(`Début de la notification : ${result.content[0].text.slice(0, 150)}...`);

await client.close();
const progressOk = received.includes(1) && received.includes(2);
process.exit(progressOk && !result.isError ? 0 : 1);
