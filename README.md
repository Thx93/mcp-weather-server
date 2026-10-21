# MCP Weather Server — US alerts and forecasts for AI agents

[![CI](https://github.com/Thx93/mcp-weather-server/actions/workflows/ci.yml/badge.svg)](https://github.com/Thx93/mcp-weather-server/actions/workflows/ci.yml)
[![M8ven Score](https://m8ven.ai/badge/mcp/thx93/mcp-weather-server)](https://m8ven.ai/mcp/thx93/mcp-weather-server)
[![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/thx93/mcp-weather-server)

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
https://agent-evidence.thx93.dev/weather/mcp
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

Or straight from npm — published 2026-10-19:

```bash
npx -y @thx93/mcp-weather-server
```

Or, equivalently, as a client config entry:

```json
{
  "mcpServers": {
    "weather": { "command": "npx", "args": ["-y", "@thx93/mcp-weather-server"] }
  }
}
```

Or straight from the repository, with no registry account needed:

```bash
npm install github:Thx93/mcp-weather-server
```

That path works because `prepare` builds the server during the install; `build/` is
not committed, so without it the bin would point at a file that does not exist. It
was verified end to end — install from GitHub, then speak MCP to the result, and both
tools list with object output schemas.

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

## FAQ

**What is this?**
An MCP (Model Context Protocol) server that exposes US weather data from the National
Weather Service as two read-only tools, `get-alerts` and `get-forecast`. It runs over
stdio when you install it, and the same code is served over streamable HTTP at
`https://agent-evidence.thx93.dev/weather/mcp` where it is paid per call.

**Do I need an API key?**
No. The National Weather Service API needs no key, and neither the local server nor the
hosted endpoint asks for one, for an account, or for a signup.

**How much does it cost?**
Running it yourself is free — it is ISC-licensed and published as
`@thx93/mcp-weather-server` on npm. The hosted endpoint charges 0.01 USDC per call on
Base through x402, which is how an agent with a wallet but no ability to sign up for
anything can still call it.

**Which locations are supported?**
US only. The data is the National Weather Service's, which covers the United States and
its territories. A coordinate outside that coverage returns an error rather than a
guess.

**What do the tools return?**
`get-alerts` takes a two-letter state code and returns every active alert: event, area,
severity, description and the official instruction. `get-forecast` takes a latitude and
longitude and returns five forecast periods: name, temperature, wind speed and
direction, and the plain-language forecast. Both declare an object output schema.

**How do I add it to Claude Desktop, Cursor or another MCP client?**

```json
{
  "mcpServers": {
    "weather": { "command": "npx", "args": ["-y", "@thx93/mcp-weather-server"] }
  }
}
```

**Why does it exist?**
It began as the MCP "Build a server" tutorial and was extended: typed output schemas,
read-only annotations, a bounded fetch, an explicit failure contract and a test suite.

## Provenance

Started from the [Build an MCP server](https://modelcontextprotocol.io/docs/develop/build-server)
tutorial and then went past it: typed output schemas, read-only tool annotations, a
bounded fetch with an explicit failure contract, and a test suite. Licensed ISC.
