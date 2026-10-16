// src/http.ts
//
// Point d'entrée Streamable HTTP, en mode sans état : chaque POST /mcp crée
// un McpServer et un transport neufs, traite la requête, puis les libère.
// Toutes les routes /mcp exigent l'en-tête Authorization: Bearer <MCP_AUTH_TOKEN>.

import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { log } from "./utils/logger.js";
import { createServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3000);
const MIN_TOKEN_LENGTH = 32;

// Fail closed : sans token valide configuré, le serveur refuse de démarrer.
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
if (!AUTH_TOKEN || AUTH_TOKEN.length < MIN_TOKEN_LENGTH) {
  log(
    "error",
    "http",
    `MCP_AUTH_TOKEN manquant ou trop court (minimum ${MIN_TOKEN_LENGTH} caractères). Démarrage annulé.`,
  );
  process.exit(1);
}
const expectedToken = Buffer.from(AUTH_TOKEN);

// Comparaison à temps constant : la durée ne révèle pas à quel caractère le token diffère.
function isValidToken(provided: string): boolean {
  const providedToken = Buffer.from(provided);
  return (
    providedToken.length === expectedToken.length &&
    timingSafeEqual(providedToken, expectedToken)
  );
}

const requireToken: express.RequestHandler = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token || !isValidToken(token)) {
    log("warn", "http", "Requête refusée : token absent ou invalide", {
      ip: req.ip,
    });
    res
      .status(401)
      .set("WWW-Authenticate", "Bearer")
      .json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      });
    return;
  }
  next();
};

const app = express();
app.use(express.json());

app.post("/mcp", requireToken, async (req, res) => {
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
app.get("/mcp", requireToken, methodNotAllowed);
app.delete("/mcp", requireToken, methodNotAllowed);

app.listen(PORT, () => {
  log("info", "http", `Serveur MCP Streamable HTTP en écoute sur le port ${PORT}`);
});
