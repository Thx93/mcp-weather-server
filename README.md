# A Simple MCP Weather Server written in TypeScript

[![CI](https://github.com/Thx93/mcp-weather-server/actions/workflows/ci.yml/badge.svg)](https://github.com/Thx93/mcp-weather-server/actions/workflows/ci.yml)
[![M8ven Score](https://m8ven.ai/badge/mcp/thx93/mcp-weather-server)](https://m8ven.ai/mcp/thx93/mcp-weather-server)

A minimal [Model Context Protocol](https://modelcontextprotocol.io) server that
exposes US weather data from the
[National Weather Service API](https://www.weather.gov/documentation/services-web-api)
as two read-only tools.

The NWS API is free, keyless and US-only, so this server needs no credentials and
no account to run.

| Tool | Input | Returns |
|---|---|---|
| `get-alerts` | `state` — two-letter code, e.g. `CA` | Active weather alerts for that state |
| `get-forecast` | `latitude`, `longitude` | The next five forecast periods for that point |

Both tools are annotated `readOnlyHint: true` and `destructiveHint: false`, so a
host that respects tool annotations can invoke them without asking first. Both
reach out to `api.weather.gov` and are marked `openWorldHint: true` for that reason.

## Use it hosted, paid per call

Running it yourself costs nothing. There is also a **hosted version, paid per call
in USDC on Base over x402**, for agents that would rather not carry a Node process
and a data layer:

```
https://agent-evidence-api.thx93.workers.dev/weather/mcp
```

It serves the same two tools, with the same output schemas and the same `null`
fallbacks, plus a free `health` tool and free `tools/list` so the service can be
discovered and probed before paying. Discovery is free; a `tools/call` for
`get-alerts` or `get-forecast` returns 402 with the price. Both are declared
read-only, so a host that respects annotations will not ask twice.

The `server.json` in this repository advertises that remote, so an MCP client can
install it by registry name rather than by cloning anything.

## Prerequisites

- Node.js 24+
- npm

## Build, test and run

```bash
npm install
npm test          # builds, then runs the suite
npm run build     # compile only
node build/index.js
```

The suite drives the real server over `InMemoryTransport` with the NWS API stubbed,
so `npm test` touches no network and needs no credentials. It covers tool
discovery and annotations, the `get-alerts` and `get-forecast` data paths, the
fallbacks for fields the NWS sends as `null`, the failure contract, and input
validation.

Running `node build/index.js` speaks the MCP protocol over stdio: it prints to
stderr and waits for a client on stdin, so it is meant to be launched by a host
rather than by hand.

## Adding it to a client

Most MCP hosts use the same three-line shape:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-weather-server/build/index.js"]
    }
  }
}
```

Or with `npx`, once the package is published:

```json
{
  "mcpServers": {
    "weather": { "command": "npx", "args": ["-y", "@thx93/mcp-weather-server"] }
  }
}
```

## Verified against the source

The tools return the National Weather Service's own data, so correctness is
checkable rather than asserted. On 2026-10-19, `api.weather.gov` reported one active
alert for TX and a paid call to the hosted `get-alerts` returned exactly one -
`Event: Flood Advisory` - for the same state.

That matters more than it sounds: the sibling evidence service carries a documented
reliability gap in its *verdict* (see its `docs/evidence-quality.md`), while these
tools have no inferred judgement to get wrong. They fetch and reshape; the values are
the NWS's.

## Behaviour worth knowing

**Failures are tool results, not protocol errors.** A request the NWS cannot answer —
a non-US location, an outage, a timeout — comes back as
`{ isError: true, content: [{ type: "text", text: "<what failed>" }] }`. That is
the MCP contract for "this call was well formed and the work failed", as distinct
from a JSON-RPC error, which means the call itself was broken. A client can show
the text to a user and retry.

**The NWS is slow to give up and we are not.** Every request carries a 10-second
timeout, so a stalled upstream surfaces as a failed tool call instead of a hung one.

**Missing fields fall back rather than printing `null`.** The NWS returns `null` for
fields it does not have. A missing event name renders as `Unknown`, a missing
temperature as `Unknown` — never the literal string `null`.

**`get-forecast` returns at most five periods.** Enough to answer "what is the
weather like", short enough for a context window.

## Structured content

Both tools declare an `outputSchema` and return `structuredContent`, and both
schemas are **objects**: `get-forecast` returns `{ latitude, longitude, periods }`,
`get-alerts` returns `{ alerts: [...] }`.

`get-alerts` previously declared a top-level array, which protocol revision
`2026-07-28` does permit. It was changed because a client on the widely-deployed MCP
SDK rejects the entire `tools/list` response when it meets an array schema —
`invalid_value: expected "object"` — so such a client cannot connect to the server
at all. Wrapping the array in an object is what makes these tools reachable from
ordinary clients; the textual summary a model reads is unchanged.

## Provenance

Started from the [Build an MCP server](https://modelcontextprotocol.io/docs/develop/build-server)
tutorial and then went past it: typed output schemas, read-only tool annotations, a
bounded fetch with an explicit failure contract, and a test suite. Licensed ISC.
