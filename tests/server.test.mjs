/**
 * Tests for the weather MCP server.
 *
 * Plain `.mjs` on purpose: these run against `build/server.js`, the artifact that
 * actually ships, so the suite also proves the compiled entrypoint exports what the
 * documentation claims. Run them with `npm test` (which builds first).
 *
 * The server is driven over `InMemoryTransport` with raw JSON-RPC rather than
 * through a client library — there is no client package installed here, and the
 * wire shape is exactly what a host sends. The NWS API is replaced by a stubbed
 * `globalThis.fetch`, so nothing in this file touches the network.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { InMemoryTransport, LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/server";

import {
  buildServer,
  formatAlert,
  formatPeriod,
  makeNWSRequest,
  NWS_API_BASE,
  USER_AGENT,
} from "../build/server.js";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** One in-process server plus the client end of the transport. */
function link() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildServer();
  return { clientTransport, serverTransport, server };
}

/**
 * Drive one server through its lifecycle: initialize, run `body`, close.
 * Returns `{request, notify}` where `request` resolves to the raw JSON-RPC
 * message (result or error) so a test can assert on either.
 */
async function session(body) {
  const { clientTransport, serverTransport, server } = link();
  const pending = new Map();
  let seq = 0;

  clientTransport.onmessage = (message) => {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    entry(message);
  };

  const send = (message) => clientTransport.send(message);
  const request = (method, params) => {
    const id = ++seq;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      send({ jsonrpc: "2.0", id, method, params });
    });
  };
  const notify = (method, params) => send({ jsonrpc: "2.0", method, params });

  await server.connect(serverTransport);
  await clientTransport.start();

  try {
    await request("initialize", {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "weather-tests", version: "0" },
    });
    await notify("notifications/initialized");
    return await body({ request, notify });
  } finally {
    await server.close();
    await clientTransport.close();
  }
}

/** Call a tool and return the JSON-RPC message it answered with. */
const callTool = (request, name, args) =>
  request("tools/call", { name, arguments: args ?? {} });

const listTools = (request) => request("tools/list", {});

/**
 * `get-alerts` declares a top-level ARRAY output schema, which the SDK projects
 * onto `{ result: [...] }` on the wire for clients on older protocol revisions.
 * Unwrap whichever shape came back so these assertions are about the data rather
 * than about that compatibility shim.
 */
const alertRecords = (result) => {
  const structured = result.structuredContent;
  return Array.isArray(structured) ? structured : structured.result;
};


// ---------------------------------------------------------------------------
// NWS stub
// ---------------------------------------------------------------------------

const POINTS_URL = `${NWS_API_BASE}/points/38.9000,-77.0000`;
const FORECAST_URL = `${NWS_API_BASE}/gridpoints/LWX/96,71`;
const ALERTS_CA = `${NWS_API_BASE}/alerts/active/area/CA`;

/** Every request URL this test run makes, for asserting what we actually asked for. */
let seen;
let routes;
const realFetch = globalThis.fetch;

beforeEach(() => {
  seen = [];
  routes = new Map();
  globalThis.fetch = async (input) => {
    const url = String(input);
    seen.push(url);
    const entry = routes.get(url);
    if (!entry) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(entry.body), {
      status: entry.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** The NWS alert payload, with the nulls the API really sends for missing fields. */
const ALERT_FEATURES = {
  features: [
    {
      properties: {
        event: "Winter Storm Warning",
        areaDesc: "Central Virginia",
        severity: "Severe",
        description: "Heavy snow expected.",
        instruction: "Avoid travel.",
      },
    },
    {
      properties: {
        // Every field null: the server must fall back rather than print "null".
        event: null,
        areaDesc: null,
        severity: null,
        description: null,
        instruction: null,
      },
    },
  ],
};

const TWO_PERIODS = {
  properties: {
    periods: [
      {
        name: "Today",
        temperature: 72,
        temperatureUnit: "F",
        windSpeed: "5 mph",
        windDirection: "NW",
        detailedForecast: "Sunny.",
      },
      {
        name: "Tonight",
        temperature: null,
        temperatureUnit: "F",
        windSpeed: "0 mph",
        windDirection: "N",
        detailedForecast: "Clear.",
      },
    ],
  },
};

const SIX_PERIODS = {
  properties: {
    periods: Array.from({ length: 6 }, (_, i) => ({
      name: `Period ${i + 1}`,
      temperature: 60 + i,
      temperatureUnit: "F",
      windSpeed: "1 mph",
      windDirection: "N",
      detailedForecast: `Forecast ${i + 1}.`,
    })),
  },
};

// ---------------------------------------------------------------------------
// Tool discovery
// ---------------------------------------------------------------------------

describe("tools/list", () => {
  test("exposes exactly the two documented tools", async () => {
    await session(async ({ request }) => {
      const message = await listTools(request);
      const names = message.result.tools.map((tool) => tool.name).sort();
      assert.deepEqual(names, ["get-alerts", "get-forecast"]);
    });
  });

  test("both tools declare themselves read-only", async () => {
    await session(async ({ request }) => {
      const message = await listTools(request);
      for (const tool of message.result.tools) {
        assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} readOnlyHint`);
        assert.equal(tool.annotations.destructiveHint, false, `${tool.name} destructiveHint`);
        assert.equal(tool.annotations.idempotentHint, true, `${tool.name} idempotentHint`);
        assert.equal(tool.annotations.openWorldHint, true, `${tool.name} openWorldHint`);
      }
    });
  });

  test("each tool declares an input and an output schema", async () => {
    await session(async ({ request }) => {
      const message = await listTools(request);
      for (const tool of message.result.tools) {
        assert.equal(tool.inputSchema.type, "object", `${tool.name} input schema`);
        assert.ok(tool.outputSchema, `${tool.name} must declare an output schema`);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// get-alerts
// ---------------------------------------------------------------------------

describe("get-alerts", () => {
  test("returns alerts and a readable summary", async () => {
    routes.set(ALERTS_CA, { body: ALERT_FEATURES });
    await session(async ({ request }) => {
      const message = await callTool(request, "get-alerts", { state: "ca" });
      const result = message.result;

      assert.equal(result.isError, undefined);
      assert.equal(alertRecords(result).length, 2);
      assert.equal(alertRecords(result)[0].event, "Winter Storm Warning");
      assert.equal(alertRecords(result)[0].area, "Central Virginia");
      assert.match(result.content[0].text, /Active alerts for CA/);
      assert.match(result.content[0].text, /Winter Storm Warning/);
    });
  });

  test("a lower-case state code is normalised and requested uppercase", async () => {
    routes.set(ALERTS_CA, { body: { features: [] } });
    await session(async ({ request }) => {
      await callTool(request, "get-alerts", { state: "ca" });
      assert.deepEqual(seen, [ALERTS_CA]);
    });
  });

  test("null NWS fields fall back rather than printing null", async () => {
    routes.set(ALERTS_CA, { body: ALERT_FEATURES });
    await session(async ({ request }) => {
      const message = await callTool(request, "get-alerts", { state: "CA" });
      const second = alertRecords(message.result)[1];
      assert.deepEqual(second, {
        event: "Unknown",
        area: "Unknown",
        severity: "Unknown",
        description: "No description available",
        instructions: "No specific instructions provided",
      });
    });
  });

  test("no active alerts is a result, not an error", async () => {
    routes.set(ALERTS_CA, { body: { features: [] } });
    await session(async ({ request }) => {
      const message = await callTool(request, "get-alerts", { state: "CA" });
      assert.equal(message.result.isError, undefined);
      assert.deepEqual(alertRecords(message.result), []);
      assert.equal(message.result.content[0].text, "No active alerts for CA");
    });
  });

  test("a failing NWS call is an isError tool result, not a protocol error", async () => {
    routes.set(ALERTS_CA, { status: 503, body: {} });
    await session(async ({ request }) => {
      const message = await callTool(request, "get-alerts", { state: "CA" });
      assert.equal(message.result.isError, true);
      assert.match(message.result.content[0].text, /Failed to retrieve alerts data for CA/);
    });
  });

  test("rejects a state code that is not two characters", async () => {
    await session(async ({ request }) => {
      const message = await callTool(request, "get-alerts", { state: "CALIFORNIA" });
      // Bad arguments are a broken call: either a JSON-RPC error or an isError
      // result is acceptable, but a successful result is not.
      const ok = message.result && message.result.isError !== true;
      assert.equal(ok, false, `expected a rejection, got ${JSON.stringify(message)}`);
    });
  });
});

// ---------------------------------------------------------------------------
// get-forecast
// ---------------------------------------------------------------------------

describe("get-forecast", () => {
  test("walks points -> forecast and returns at most 5 periods", async () => {
    routes.set(POINTS_URL, { body: { properties: { forecast: FORECAST_URL } } });
    routes.set(FORECAST_URL, { body: SIX_PERIODS });
    await session(async ({ request }) => {
      const message = await callTool(request, "get-forecast", {
        latitude: 38.9,
        longitude: -77,
      });
      const result = message.result;

      assert.equal(result.isError, undefined);
      assert.equal(result.structuredContent.periods.length, 5, "cap at 5 periods");
      assert.equal(result.structuredContent.periods[0].name, "Period 1");
      assert.deepEqual(seen, [POINTS_URL, FORECAST_URL]);
    });
  });

  test("maps NWS camelCase fields onto the documented snake_case schema", async () => {
    routes.set(POINTS_URL, { body: { properties: { forecast: FORECAST_URL } } });
    routes.set(FORECAST_URL, { body: TWO_PERIODS });
    await session(async ({ request }) => {
      const message = await callTool(request, "get-forecast", {
        latitude: 38.9,
        longitude: -77,
      });
      const [today, tonight] = message.result.structuredContent.periods;
      assert.deepEqual(today, {
        name: "Today",
        temperature: 72,
        temperature_unit: "F",
        wind_speed: "5 mph",
        wind_direction: "NW",
        detailed_forecast: "Sunny.",
      });
      assert.equal(tonight.temperature, null);
    });
  });

  test("a null temperature renders as Unknown, not 'null'", async () => {
    routes.set(POINTS_URL, { body: { properties: { forecast: FORECAST_URL } } });
    routes.set(FORECAST_URL, { body: TWO_PERIODS });
    await session(async ({ request }) => {
      const message = await callTool(request, "get-forecast", {
        latitude: 38.9,
        longitude: -77,
      });
      assert.match(message.result.content[0].text, /Temperature: Unknown/);
    });
  });

  test("a location the NWS does not cover is an isError tool result", async () => {
    routes.set(POINTS_URL, { status: 404, body: {} });
    await session(async ({ request }) => {
      const message = await callTool(request, "get-forecast", {
        latitude: 38.9,
        longitude: -77,
      });
      assert.equal(message.result.isError, true);
      assert.match(message.result.content[0].text, /only US locations are supported/);
    });
  });

  test("rejects coordinates outside the valid range", async () => {
    await session(async ({ request }) => {
      const message = await callTool(request, "get-forecast", {
        latitude: 999,
        longitude: -77,
      });
      const ok = message.result && message.result.isError !== true;
      assert.equal(ok, false, `expected a rejection, got ${JSON.stringify(message)}`);
    });
  });
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("formatAlert", () => {
  test("renders every field on its own line, terminated", () => {
    const out = formatAlert({
      event: "Flood Watch",
      area: "Travis County",
      severity: "Minor",
      description: "Rising water.",
      instructions: "Move to higher ground.",
    });
    assert.equal(
      out,
      [
        "Event: Flood Watch",
        "Area: Travis County",
        "Severity: Minor",
        "Description: Rising water.",
        "Instructions: Move to higher ground.",
        "---",
      ].join("\n"),
    );
  });
});

describe("formatPeriod", () => {
  test("renders a measured temperature with its unit", () => {
    const out = formatPeriod({
      name: "Tonight",
      temperature: 51,
      temperature_unit: "F",
      wind_speed: "3 mph",
      wind_direction: "S",
      detailed_forecast: "Cloudy.",
    });
    assert.match(out, /Temperature: 51°F/);
    assert.match(out, /Wind: 3 mph S/);
  });

  test("renders a missing temperature as Unknown", () => {
    const out = formatPeriod({
      name: "Tonight",
      temperature: null,
      temperature_unit: "F",
      wind_speed: "0 mph",
      wind_direction: "N",
      detailed_forecast: "Clear.",
    });
    assert.match(out, /Temperature: Unknown/);
    assert.doesNotMatch(out, /null/);
  });
});

// ---------------------------------------------------------------------------
// makeNWSRequest
// ---------------------------------------------------------------------------

describe("makeNWSRequest", () => {
  test("identifies itself to the NWS and accepts GeoJSON", async () => {
    let headers;
    globalThis.fetch = async (_url, init) => {
      headers = init.headers;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const result = await makeNWSRequest("https://api.weather.gov/test");
    assert.deepEqual(result, { ok: true });
    assert.equal(headers["User-Agent"], USER_AGENT);
    assert.equal(headers.Accept, "application/geo+json");
  });

  test("returns null on a non-2xx status", async () => {
    globalThis.fetch = async () => new Response("nope", { status: 500 });
    assert.equal(await makeNWSRequest("https://api.weather.gov/test"), null);
  });

  test("returns null when the request itself fails", async () => {
    globalThis.fetch = async () => {
      throw new Error("socket hang up");
    };
    assert.equal(await makeNWSRequest("https://api.weather.gov/test"), null);
  });

  test("binds a timeout so a stalled NWS cannot hang a call", async () => {
    let signal;
    globalThis.fetch = async (_url, init) => {
      signal = init.signal;
      return new Response("{}", { status: 200 });
    };
    await makeNWSRequest("https://api.weather.gov/test");
    assert.ok(signal instanceof AbortSignal, "expected an AbortSignal");
    assert.ok(signal.aborted !== true, "the timeout must not fire immediately");
  });
});
