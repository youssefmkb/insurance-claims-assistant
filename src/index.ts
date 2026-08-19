// src/index.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { log } from "./utils/logger.js";

import { analyzeClaimTool, analyzeClaimReport } from "./tools/analyze-claim.js";
import {
  classifyClaimTool,
  classifyClaimSeverity,
} from "./tools/classify-claim.js";
import {
  generateNotificationTool,
  generateBrokerNotification,
} from "./tools/generate-notification.js";

import type { ClaimData, ClassificationResult } from "./types/claim.types.js";

const server = new McpServer({
  name: "insurance-claims-assistant",
  version: "1.0.0",
});

// Tool 1 : analyze_claim_report
server.registerTool(
  analyzeClaimTool.name,
  {
    description: analyzeClaimTool.description,
    inputSchema: {
      rawText: z.string().describe("Texte brut du constat amiable"),
      claimId: z.string().describe("Identifiant unique du sinistre"),
    },
  },
  async ({ rawText, claimId }) => {
    log("info", "index", `Tool appelé : ${analyzeClaimTool.name}`, { claimId });

    const claimData = await analyzeClaimReport(rawText, claimId);

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(claimData, null, 2) },
      ],
    };
  },
);

// Tool 2 : classify_claim_severity
server.registerTool(
  classifyClaimTool.name,
  {
    description: classifyClaimTool.description,
    inputSchema: {
      claimData: z
        .record(z.string(), z.unknown())
        .describe("Objet ClaimData retourné par analyze_claim_report"),
    },
  },
  async ({ claimData }) => {
    const claim = claimData as unknown as ClaimData;
    log("info", "index", `Tool appelé : ${classifyClaimTool.name}`, {
      claimId: claim.claimId,
    });

    const result = await classifyClaimSeverity(claim);

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  },
);

// Tool 3 : generate_broker_notification
server.registerTool(
  generateNotificationTool.name,
  {
    description: generateNotificationTool.description,
    inputSchema: {
      claimData: z.record(z.string(), z.unknown()).describe("Objet ClaimData"),
      classification: z
        .record(z.string(), z.unknown())
        .describe("Objet ClassificationResult"),
    },
  },
  async ({ claimData, classification }, extra) => {
    const claim = claimData as unknown as ClaimData;
    const classif = classification as unknown as ClassificationResult;

    log("info", "index", `Tool appelé : ${generateNotificationTool.name}`, {
      claimId: claim.claimId,
    });

    const progressToken = extra.requestId;
    const sendProgressFn = async (
      progress: number,
      total: number,
      message?: string,
    ) => {
      await server.server.notification({
        method: "notifications/progress",
        params: {
          progressToken,
          progress,
          total,
          ...(message && { message }),
        },
      });
    };

    const notification = await generateBrokerNotification(
      claim,
      classif,
      sendProgressFn,
    );

    return {
      content: [{ type: "text" as const, text: notification }],
    };
  },
);

async function main() {
  log("info", "index", "Démarrage du serveur MCP insurance-claims-assistant");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("info", "index", "Serveur connecté et en écoute via stdio");
}

main().catch((error) => {
  console.error("Erreur fatale :", error);
  process.exit(1);
});
