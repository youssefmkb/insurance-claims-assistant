// src/index.ts

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log } from "./utils/logger.js";
import { createServer } from "./server.js";

async function main() {
  log("info", "index", "Démarrage du serveur MCP insurance-claims-assistant");
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("info", "index", "Serveur connecté et en écoute via stdio");
}

main().catch((error) => {
  console.error("Erreur fatale :", error);
  process.exit(1);
});
