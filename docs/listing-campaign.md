# MCP listing campaign — every directory, what was submitted, and what is actually live

Recorded **2026-10-18** by `listing-scout`. Two services were pushed: **Agent
Evidence API** (MCP `research_evidence`, `https://agent-evidence-api.thx93.workers.dev/mcp`)
and **NWS Weather** (`get-alerts`, `get-forecast`,
`https://agent-evidence-api.thx93.workers.dev/weather/mcp`).

## How to read the status column

| Status | Means |
|---|---|
| **live** | A public URL I fetched today returns the listing, or the directory's own API returns it. Nothing here rests on a promise. |
| **submitted** | A submission artefact exists and is verifiable (PR/issue/discussion number, submission id, or the directory's own duplicate-rejection on re-submission). It is **not** live. |
| **blocked** | No listing, and the reason is recorded with the evidence that produced it. |

The rule applied throughout: *never upgrade "submitted" to "live" on hope.* Any
row I could not verify says so.

### Baseline verified before submitting anything

```
POST https://agent-evidence-api.thx93.workers.dev/mcp          → tools: research_evidence, health
POST https://agent-evidence-api.thx93.workers.dev/weather/mcp  → tools: get-alerts, get-forecast, health
POST .../mcp  {"method":"initialize"}  → 200 serverInfo {"name":"agent-evidence-api","version":"0.1.5"}
```

Both endpoints answer `initialize` and `tools/list` **anonymously**. A `tools/call`
on a paid tool answers HTTP 402 with the x402 price. That distinction decided
several submissions: directories that only need the handshake accepted us;
directories that need free tool execution are flagged below.

## The table

| Directory | Method | Status | URL | Date | Evidence |
|---|---|---|---|---|---|
| Official MCP Registry | `mcp-publisher` (direct publish) | **live** | https://registry.modelcontextprotocol.io | 2026-10-18 | `GET /v0/servers?search=Thx93` → `io.github.Thx93/agent-evidence-api` 0.1.5 `status=active, isLatest=true`; `io.github.Thx93/weather` 1.0.0 `active, isLatest=true`; both `remotes[].url` point at the live worker. (Pre-existing; re-verified, not redone.) |
| Glama | crawls the official registry | **live** | https://glama.ai/mcp/connectors/io.github.Thx93/agent-evidence-api · https://glama.ai/mcp/connectors/io.github.Thx93/weather · https://glama.ai/mcp/servers/Thx93/mcp-weather-server | 2026-10-18 | Connector pages render with **"Ownership verified"**; `glama.ai/mcp/servers?query=Thx93` lists both connectors plus the `mcp-weather-server` repo listing (license A, quality B, TDQS scored 2026-09-24). Badge SVGs return 200. Caveat: the health probe exercises **paid** tools, so Glama reports AEA `Uptime 18.9% over 28 days` and weather `Uptime 0.0% over 25 days` — the listing is live, its health score is not good. |
| punkpeye/awesome-remote-mcp-servers (95k★) | PR | **submitted** | https://github.com/punkpeye/awesome-remote-mcp-servers/pull/2214 | 2026-10-18 | PR open, `mergeable:true`, CI labels **`endpoint-ok`** and **`has-connector`** — the list's own bot verified the live handshake and the Glama connector. Opted into the fast-track with 🤖🤖🤖 per CONTRIBUTING. |
| punkpeye/awesome-mcp-servers (95k★) | PR | **submitted** | https://github.com/punkpeye/awesome-mcp-servers/pull/16911 | 2026-10-18 | PR open, `mergeable:true`, bot labels **`has-emoji`, `valid-name`, `has-glama`** (no `missing-glama`). Entry is `Thx93/mcp-weather-server` only — the AEA repo has no Glama *repo-level* listing yet, so it would have earned a `missing-glama` label. |
| Cline Marketplace | PR (`registry/mcps/<slug>/entry.json`) | **submitted** | https://github.com/cline/marketplace/pull/279 | 2026-10-18 | PR open, `mergeable:true`, no CI labels yet. Both entries validated locally with the repo's own `node scripts/generate.mjs` → `dist/catalog.json` written with 205 entries and both new ids present. |
| Docker MCP Catalog | PR (`servers/<name>/{server.yaml,tools.json,readme.md}`, remote type) | **submitted** | https://github.com/docker/mcp-registry/pull/5839 | 2026-10-18 | PR open, `mergeable:true`, no CI labels yet. Both YAML files parse. Go is not installed in this workspace, so their `cmd/validate` could not be run locally — CI runs it. |
| TensorBlock MCP Index (7,747 servers) | PR (one line per server in `docs/*.md`) | **submitted** | https://github.com/TensorBlock/awesome-mcp-servers/pull/4090 | 2026-10-18 | PR open, `mergeable:true`. AEA → `docs/search.md`, weather → `docs/location--maps.md`. ManyCP records a median merge time of ~10 h for this list (2026-10-01). |
| mcp.so | GitHub issue on `chatmcp/mcpso` (free route) | **submitted** | https://github.com/chatmcp/mcpso/issues/5687 · https://github.com/chatmcp/mcpso/issues/5688 | 2026-10-18 | Both issues open with the directory's own "Submit Remote MCP Server" convention. The web form at `mcp.so/submit` shows **only** "Paid submission — $39 one-time publishing fee … Pay and submit automatically" (fetched today, no free option) — not used, no money spent. |
| mcpservers.org | Web form, **Free** plan (browser-submitted) | **submitted** | https://mcpservers.org/submit | 2026-10-18 | Submission **ids 12009** (AEA) and **12010** (weather) returned by `POST https://mcpservers.org/_serverFn/62b9fa28…` (HTTP 200). Page confirmed: *"Submission Successful! … Review within 2 weeks."* Free plan radio verified `checked:true`; no payment step. |
| MCP Market (mcpmarket.com) | Web form, **Free Queue** (GitHub repo) | **submitted** | https://mcpmarket.com/submit | 2026-10-18 | Confirmation text for both repos: *"Submitted! You're in the free queue — current wait is ~4–6 weeks."* The paid card is pre-selected on that page; the script asserted the submit button read **"Submit to free queue"** before clicking, so nothing was purchased. |
| MCP.Directory | Web form → `POST /api/submit-server` | **submitted** | https://mcp.directory/submit | 2026-10-18 | Both repos submitted. Re-submitting either repo now returns **HTTP 409** `{"error":"This repository has already been submitted. We'll review it soon!"}` — the directory's own duplicate check, which is only produced for a repository it already holds. Site says review within 24 h. |
| GitHub MCP Registry (github.com/mcp → VS Code / Copilot) | Discussion in `github/github-mcp-server` **Q&A** category | **submitted** | https://github.com/github/github-mcp-server/discussions/3528 · https://github.com/github/github-mcp-server/discussions/3529 | 2026-10-18 | Both discussions created via GraphQL `createDiscussion`. This is the documented route: onboarding is manual curation, and active requests use exactly this title/category shape. **Not live** — GitHub adds these by hand. |
| Smithery | `smithery mcp publish <url> -n <org>/<name>` (CLI at 4.11.1) | **blocked** | https://smithery.ai | 2026-10-18 | Registry search `registry.smithery.ai/servers?q=…` returns neither server. `npx @smithery/cli auth whoami` → **"No token found. Run 'smithery auth login' to authenticate."** `auth login` is non-TTY-safe but needs a **human to approve the OAuth URL in a browser**; there is no token to inject (no `SMITHERY_API_KEY` on this box). |
| PulseMCP (21,670 servers) | auto-indexes the official registry | **blocked** | https://www.pulsemcp.com/submit | 2026-10-18 | Submissions page: *"Apologies, submissions and changes are temporarily paused … **Last updated: September 3, 2026**."* Search `pulsemcp.com/servers?q=Thx93` → **"Showing 0 - 0 of 0 servers"**. Our registry entries landed 2026-09-21+, i.e. after the pause. Nothing to do but wait; the page itself says publishing to the official registry is the right move. |
| Cursor Directory | plugin submit at `/plugins/new` | **blocked** | https://cursor.directory/plugins/new | 2026-10-18 | The route "sends you to sign in with GitHub or Google first"; submission is a Component of a plugin (an `.mcp.json` in a repo). Needs a human sign-in; not attempted. |
| LobeHub MCP Marketplace | `npx -y @lobehub/market-cli` (`lhm plugin publish`) | **blocked** | https://market.lobehub.com/s/publish-mcp | 2026-10-18 | Their own publisher doc: *"Two commands require a human with a browser: `lhm login` and `lhm github connect`. Never try to automate or bypass them"* and *"There is no token-only, non-interactive publish path; do not look for one."* Also: **`lhm mcp` cannot publish** — M2M credentials are read-only. |
| Claude Connectors Directory (Anthropic) | developer portal `claude.ai/directory/manage` | **blocked** | https://claude.com/docs/connectors/building/submission | 2026-10-18 | Requires **"any paid Claude plan"** to submit (human + payment), plus a privacy-policy URL, support contact, icon and **reviewer test credentials**. Two further obstacles found by inspection: AEA's tools (`research_evidence`, `health`) return **no `title` and no `readOnlyHint`/`destructiveHint`**, which "the portal flags"; and there is no account to hand a reviewer — every call must be paid in USDC over x402. Weather's tools do carry titles and read-only annotations. |
| ChatGPT / Codex plugin directory (OpenAI) | developer portal upload | **blocked** | https://platform.openai.com (see ManyCP note) | 2026-10-18 | *"You verify your identity before you can upload a plugin"*; no published review time. Identity verification is a human, account-level action. |
| mcp-get | registry PR | **dead** | https://github.com/michaellatman/mcp-get | 2026-10-18 | Repository header: **"⚠️ DEPRECATED — This Project Has Moved … This repository is no longer actively maintained"**, and it now recommends Smithery. Not worth a submission. |
| MCPRush | ? | **blocked** | https://mcprush.com | 2026-10-18 | HTTP **403** to every automated client (curl and browser-UA alike); no submission mechanism reachable without solving bot protection. |
| Continue hub | directory submit | **blocked** | https://hub.continue.dev | 2026-10-18 | Host unreachable from this box: `curl` returns code **000** (no response). Not diagnosed further. |
| AIBase MCP | site form, hand review | **blocked** | https://www.aibase.com/mcp | 2026-10-18 | No public submit form found at `/mcp` or `/mcp/submit` (404); review is by hand with no published time. Not pursued. |

### Evaluated and deliberately not submitted

These are real PR-based directories, but each is a long queue with small reach
relative to the effort; recording them so nobody re-checks them:

| Directory | Why not |
|---|---|
| Kilo Marketplace | PR route; ~156 PRs waiting, 2 MCP additions merged in a month (ManyCP, 2026-10-01) |
| Goose extensions | PR route; last addition 2026-07-29 |
| ToolHive catalog | PR route; "few outside PRs get merged, most wait for weeks" |
| best-of-mcp-servers | PR route; new repos with few stars rank low — we would rank near the bottom |
| mobinx/awesome-mcp-list, ToolSDK registry | PR routes; small reach, batches every ~12 days |
| Gemini CLI Extensions | Crawls GitHub for repos with a topic **and a manifest file** (`gemini-extension.json`); would need an in-repo manifest — outside this task's write scope, and the crawl is automatic if the manifest is added later |
| M8ven Trust Index, PayAI facilitator | Already done before this task (do not redo) |
| ACI.dev, Arcade, Toolhouse | Named in the brief, but on inspection these are **platforms for building/hosting tool-calling agents**, not directories that take a publisher submission: ACI.dev is an open-source unified-MCP platform (`aipotheosis-labs/aci`) you connect or self-host, not a catalog you are listed in. No submission route was found; they are not listing channels. |

## What would move the needle

Ranked by expected reach, and by what each one actually requires.

### 1. Anthropic's Claude Connectors Directory — the largest audience we do not reach

Tens of millions of Claude users, and connectors are discoverable inside the
product. It is **blocked on four concrete things**, only one of which is technical:

1. A **paid Claude plan** and a human login at `claude.ai/directory/manage`.
2. Listing materials: docs URL, **privacy policy URL**, support contact, icon.
3. **Reviewer test credentials.** For a pay-per-call server there is no account to
   hand over — this needs a decision: fund a dedicated x402 test key, or add a
   free sandbox tool that reviewers can call (e.g. `health` already exists; a free
   single-URL evidence call would be the honest equivalent).
4. **Tool metadata**: AEA's tools need a `title` and a `readOnlyHint` /`destructiveHint`
   annotation. Weather already has both. That is a small code change in
   `packages/mcp`, outside this task's write scope.

### 2. GitHub MCP Registry — submitted, needs nothing but a reviewer

Reach: every VS Code / Copilot user through `github.com/mcp`. Onboarding requests
**#3528** and **#3529** are posted in the right category with the right shape, and
that is the entire available process — curation is manual ("7 of 61 onboarding
requests since 9 July 2026 name servers it now lists"). Nothing else can be done
from here. The follow-on to this channel is the OpenAI/ChatGPT directory, which is
blocked on identity verification.

### 3. Smithery — one human command away from a live listing

Smithery lists a remote server after scanning its live URL, and our server passes
that scan (the awesome-remote CI bot already proved the handshake, labelling our PR
`endpoint-ok`). The **entire blocker is one interactive OAuth**:

```bash
export PATH="/root/dsh-workspace/bin:$PATH"
npx -y @smithery/cli auth login                     # human opens the printed URL
npx -y @smithery/cli mcp publish \
  "https://agent-evidence-api.thx93.workers.dev/mcp"        -n @Thx93/agent-evidence-api
npx -y @smithery/cli mcp publish \
  "https://agent-evidence-api.thx93.workers.dev/weather/mcp" -n @Thx93/weather
```

Everything except the login has been verified to be available on this box
(CLI 4.11.1 installs from the public npm registry despite the revoked publish
token — installs are unaffected).

### The runner-up worth knowing about

The two **punkpeye** lists (95k★ combined) already accepted our PRs past their own
bots — `endpoint-ok` + `has-connector` on one, `has-emoji`/`valid-name`/`has-glama`
on the other. Both queues hold hundreds of open PRs, so the listing may take weeks,
but no further action is required and no action would speed it up.

## Every action still needing a human

| # | Action | Where | Why it cannot be automated |
|---|---|---|---|
| 1 | `npx -y @smithery/cli auth login` | smithery.ai | OAuth approval in a browser; no token path exists |
| 2 | Claim both Glama listings | https://glama.ai/sign-in | Glama sign-in; yields owner badge, test-profile health checks (our 0%/18.9% uptime would be fixable with a test profile) |
| 3 | Claude Connectors submission | claude.ai/directory/manage | Requires a paid Claude plan + reviewer test credentials |
| 4 | `lhm login` + `lhm github connect` | market.lobehub.com | Publisher docs forbid automating these |
| 5 | Sign in at cursor.directory | cursor.directory/plugins/new | GitHub/Google sign-in gate |
| 6 | Add `title` + annotations to AEA tools | `agent-evidence-api/packages/mcp` | Code change outside this task's write scope |
| 7 | Decide on a reviewer-facing free call | AEA worker | Product decision, not a listing action |
| 8 | Optional: $39 for mcp.so premium, $29 for MCP Market fast lane | — | **Not recommended and not spent.** Both free routes were used instead. |

## Cost and honesty ledger

- **Money spent: 0.** No paid tier was entered for either server: mcp.so's form is
  $39-only so the free GitHub-issue route was used; MCP Market's pre-selected paid
  card was explicitly switched to the free queue and the button label asserted
  before clicking; mcpservers.org's free plan was left selected.
- **No account was created.** The only identity used is the existing `Thx93` GitHub
  account and the project's own outreach mailbox as contact address.
- **No secret was printed, emailed or committed.** No npm publish was attempted, so
  the revoked npm token never came into play.
- **Nothing here is claimed live that was not fetched today.** The three live rows
  each cite a URL that returns the listing or the registry API that returns the
  entry.
