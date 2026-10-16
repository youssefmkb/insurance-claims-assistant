// src/http.ts
//
// Point d'entrée Streamable HTTP, en mode sans état : chaque POST /mcp crée
// un McpServer et un transport neufs, traite la requête, puis les libère.

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { log } from "./utils/logger.js";
import { createServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // undefined = mode sans état, pas de session
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    log("error", "http", "Erreur pendant le traitement de /mcp", {
      error: String(error),
    });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// En mode sans état, il n'y a ni flux SSE à ouvrir (GET) ni session à fermer (DELETE).
const methodNotAllowed = (_req: express.Request, res: express.Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed" },
    id: null,
  });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, () => {
  log("info", "http", `Serveur MCP Streamable HTTP en écoute sur le port ${PORT}`);
});
