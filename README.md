# Insurance Claims Assistant

An MCP server for automated car insurance claim processing, built with TypeScript and the Anthropic Claude API.

I built this after a year working on Guidewire ClaimCenter at AXA France, where I integrated the EDI broker flows (506/508/509) for automated claim opening and modification. The business logic here mirrors what I dealt with there — entity extraction, severity triage, broker notifications — but implemented with LLMs instead of static rules.

The core of it is a two-model validation pipeline: a fast model classifies, a stronger model reviews and can overrule it before anything ships.

## What it does

Three tools, chained together:

```Raw claim text
    ↓  analyze_claim_report
Structured ClaimData
    ↓  classify_claim_severity
Severity + judge verdict
    ↓  generate_broker_notification
Formal broker notification
```

## The judge

Classification runs through two models.

Claude Haiku takes the structured claim and returns a severity plus a confidence score and its reasoning. Claude Sonnet then receives the same claim data alongside Haiku's answer, and returns a verdict:

```json
{
  "approved": false,
  "feedback": "Injuries confirmed in the report — AUTO_PROCESS is not applicable",
  "finalSeverity": "URGENT_ESCALATION"
}
```

Sonnet doesn't ask Haiku to retry. It overrides directly, and `finalSeverity` is what the pipeline uses downstream. The judge always has the last word.

The reason this pattern is here and not somewhere cheaper: in claims processing, a misclassification isn't a cosmetic error. An `URGENT_ESCALATION` claim with injuries routed to `AUTO_PROCESS` means someone waits longer for assistance. Haiku is cheap enough to run on every claim; Sonnet costs more but only runs once, as a gate.

### analyze_claim_report

Takes raw accident report text and returns structured JSON: vehicles, parties, damages, circumstances, witnesses.

Uses an Agent Skill pattern — the extraction prompt lives in its own module (`skills/claim-extraction.skill.ts`) rather than being inlined in the tool.

### classify_claim_severity

Classifies a claim as `AUTO_PROCESS`, `REVIEW_NEEDED`, or `URGENT_ESCALATION`.

### generate_broker_notification

Generates a formal notification letter for the broker, with the required actions based on the severity classification.

This one sends MCP progress notifications (1/3, 2/3, 3/3) so the client can display real-time status.

## Architecture

```src/
├── index.ts                       MCP server, tool registration
├── tools/
│   ├── analyze-claim.ts
│   ├── classify-claim.ts
│   └── generate-notification.ts
├── skills/
│   └── claim-extraction.skill.ts  Reusable prompt template
├── judge/
│   └── classification-judge.ts    Sonnet validates Haiku
├── utils/
│   ├── anthropic-client.ts        Shared SDK instance + model config
│   ├── logger.ts                  stderr logging
│   └── progress.ts                Progress notification helper
└── types/
    └── claim.types.ts
```

### A few decisions worth explaining

**Logging goes to stderr, not stdout.** MCP servers using stdio transport reserve stdout for JSON-RPC messages. A stray `console.log` corrupts the protocol and the client drops the connection. Everything logs to stderr instead.

**Haiku everywhere except the judge.** Extraction, classification, and notification generation all run on Haiku. Sonnet only runs as the validator. On a real claim volume, that cost difference matters.

**Progress notifications are optional.** The `sendProgressFn` parameter is optional so the tool still works with clients that don't support progress updates. No client should crash because it didn't send a progress token.

**Zod for input validation.** The MCP SDK uses Zod schemas to validate tool inputs at the server boundary, before any business logic runs. It also gives typed handler arguments for free.

## Setup

Requires Node.js 18+ and an Anthropic API key.

```bash
git clone https://github.com/youssefmkb/insurance-claims-assistant
cd insurance-claims-assistant
npm install
cp .env.example .env    # add your API key
npm run build
```

Run the server:

```bash
node dist/index.js
```

Test it with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Screenshots

Tools exposed by the server:

![Tools list](docs/images/01-tools-list.png)

Entity extraction from a raw accident report:

![Analyze claim](docs/images/02-analyze-claim-result.png)

Classification with the judge verdict:

![Classify claim](docs/images/03-classify-claim-result.png)

Broker notification, with progress updates visible bottom right:

![Generate notification](docs/images/04-generate-notification-result.png)

## Stack

Node.js, TypeScript, `@modelcontextprotocol/sdk` v4, Anthropic SDK (Haiku + Sonnet), Zod, stdio transport.

## V2 ideas

Things I'd add if this went further:

- **Actual email delivery** — right now the notification is generated but not sent. Hooking up SendGrid or Nodemailer would close the loop.
- **Persistence** — claims are stateless today. A database would let you track a claim across its lifecycle instead of processing each call in isolation.
- **MCP sampling** — let the server request completions from the client's model rather than calling the API directly.
- **Remote transport** — currently stdio only. Streamable HTTP would make it deployable.

## Author

Youssef Mokhbi — [github.com/youssefmkb](https://github.com/youssefmkb) · [LinkedIn](https://linkedin.com/in/youssef-mokhbi-654a9b10a)
