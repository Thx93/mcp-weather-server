/**
 * Entrypoint for the weather MCP server.
 *
 * Everything testable lives in `server.ts`; this file exists so that importing
 * `server.ts` has no side effect. Running `node build/index.js` speaks the MCP
 * protocol over stdio and waits for a client on stdin.
 */
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { buildServer } from "./server.js";

// One factory serves both protocol eras.
serveStdio(buildServer, {
  onerror: (error) => {
    console.error("Weather MCP Server error:", error);
  },
});
console.error("Weather MCP Server running on stdio");
