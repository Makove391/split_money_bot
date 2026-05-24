# CLAUDE.md

This file gives Claude Code the context it needs to work effectively on this repository.

## Project Overview

A Telegram bot with simple request/response logic and a small database. Hosted entirely on Cloudflare's free tier.

**Core behavior:** the bot receives messages via Telegram webhook, optionally reads/writes a small amount of per-user state, and replies. No long-running jobs, no heavy computation, no large media processing.

## Tech Stack

- **Runtime:** Cloudflare Workers (V8 isolates, not Node.js)
- **Language:** TypeScript
- **Telegram framework:** [grammY](https://grammy.dev) — imported as `grammy` (the `grammy/web` bundle is automatically resolved on Workers)
- **Database:** Cloudflare D1 (serverless SQLite, bound directly to the Worker)
- **Deploy tool:** Wrangler (`wrangler deploy`)
- **Version control & CI:** GitHub with GitHub Actions
- **Secret management:** Cloudflare Worker secrets (NOT GitHub Actions secrets for runtime secrets — see below)
- **Update mechanism:** webhooks (NOT long polling — polling doesn't fit the serverless model)

## Why this stack

Documented here so future changes don't accidentally undo the reasoning:

- **Workers over Lambda/Azure Functions:** no cold starts (V8 isolates), 100K requests/day free tier, unlimited bandwidth, global edge deployment. Cold starts on Lambda/Azure add ~1-2s latency which feels sluggish in a chat UI.
- **D1 over MongoDB/KV:** D1 is bound natively to the Worker (no connection strings, no auth), gives real SQL, and the free tier (5GB storage, 5M reads/day, 100K writes/day) far exceeds anything a hobby bot will hit. KV was considered but rejected: only 1K writes/day on the free tier, and it's eventually consistent (bad for "remember what the user just said").
- **grammY over Telegraf:** Telegraf is less actively maintained. grammY has first-class Workers support via `webhookCallback(bot, "cloudflare-mod")` and a `grammy/web` bundle designed for non-Node runtimes.
- **Webhooks over long polling:** polling requires an always-on process, which defeats the serverless model. Webhooks fit Workers' request/response shape exactly.

## Project Structure

```
/
├── src/
│   ├── index.ts        # Worker entry point — exports default { fetch }
│   ├── bot.ts          # grammY bot setup, command handlers, middleware
│   └── db.ts           # D1 query helpers
├── migrations/         # D1 schema migrations (SQL files)
├── wrangler.toml       # Worker config, D1 binding, env vars
├── package.json
└── tsconfig.json
```

## Key Code Patterns

### Worker entry point

```ts
import { Bot, webhookCallback } from "grammy";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const bot = new Bot(env.BOT_TOKEN, {
      botInfo: JSON.parse(env.BOT_INFO),
    });
    // register handlers...
    return webhookCallback(bot, "cloudflare-mod")(request);
  },
};
```

- `botInfo` is pre-fetched from `getMe` and stored as an env var so the Worker doesn't call Telegram on every cold start to learn its own identity.
- The `"cloudflare-mod"` adapter is required — don't change it.

### Env type

`Env` should include at minimum:

```ts
interface Env {
  BOT_TOKEN: string;       // secret, set via `wrangler secret put BOT_TOKEN`
  BOT_INFO: string;        // JSON string from getMe response
  WEBHOOK_SECRET: string;  // secret token Telegram includes in webhook headers
  DB: D1Database;          // D1 binding configured in wrangler.toml
}
```

### Webhook secret verification

Always verify the `X-Telegram-Bot-Api-Secret-Token` header against `env.WEBHOOK_SECRET` before processing. Anyone who guesses the Worker URL could otherwise spam it.

### D1 queries

Use prepared statements with parameter binding — D1's API mirrors Cloudflare's D1 client:

```ts
const result = await env.DB
  .prepare("SELECT * FROM users WHERE telegram_id = ?")
  .bind(userId)
  .first();
```

Don't string-interpolate user input into SQL.

## Constraints to Remember

These are real Workers/Telegram limits that shape what's allowed:

- **CPU time:** 10ms per invocation on the free tier. This is *CPU* time only — time awaiting Telegram API, D1, or any `fetch` call doesn't count. But synchronous parsing of large payloads, regex on long strings, or crypto work in JS will eat the budget.
- **Memory:** 128 MB per isolate. Plenty for this use case.
- **Request body:** Telegram updates are small (typically <10KB), so no issue.
- **No Node APIs:** `fs`, `net`, raw TCP, native bindings — none of these work. Stick to Web APIs (`fetch`, `crypto.subtle`, `Request`/`Response`).
- **No persistent in-memory state between requests:** each request may run on a different isolate. Any state that must survive across messages goes in D1.
- **Telegram webhook ports:** must be 443, 80, 88, or 8443 with TLS 1.2+. The default `*.workers.dev` domain serves valid certs on 443, so typically works without a custom domain. If `setWebhook` fails with an SSL error, fall back to a custom domain on Cloudflare.

## Session / Multi-Step Conversations

If a feature needs multi-step state ("ask name → ask age → save"):

- Use grammY's `conversations` plugin with a D1-backed session storage adapter.
- Do NOT use the default in-memory session store — it doesn't survive across isolates.
- Keep state minimal; D1 writes count against the daily 100K limit (still huge, but worth being conscious of).

For one-shot stateless replies, no session layer is needed at all.

## Local Development

- `wrangler dev` runs the Worker locally with the D1 binding pointed at a local SQLite file.
- For local Telegram testing, either:
  - Use long polling (`bot.start()`) in a separate dev-only entry file, OR
  - Expose `wrangler dev` via Cloudflare Tunnel and point `setWebhook` at the tunnel URL.
- Secrets in dev go in `.dev.vars` (gitignored). Production secrets via `wrangler secret put`.

## Secrets & Configuration

Two distinct categories — do not confuse them:

**Cloudflare Worker secrets (runtime)** — read by the Worker at request time via `env.X`. These are the source of truth for anything the bot needs to function:

- `BOT_TOKEN` — Telegram bot token from BotFather
- `BOT_INFO` — JSON string of the bot's identity (from `getMe`), used to skip a startup API call
- `WEBHOOK_SECRET` — random string Telegram sends in the `X-Telegram-Bot-Api-Secret-Token` header for webhook authentication

Set these once via `wrangler secret put <NAME>`. They live only on Cloudflare. Do not commit them anywhere. Do not store them in GitHub.

**GitHub Actions secrets (deploy-time only)** — used by the workflow to authenticate against Cloudflare. Never read by the Worker:

- `CLOUDFLARE_API_TOKEN` — scoped API token from the Cloudflare dashboard (use the "Edit Cloudflare Workers" template)
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

Set in the repo under Settings → Secrets and variables → Actions. Use repository secrets (not environment secrets) unless you set up explicit GitHub Environments.

**Dev secrets** live in `.dev.vars` (gitignored) and are loaded automatically by `wrangler dev`. Same key names as the production secrets.

## Deployment

Two paths — pick one and stick with it:

**Manual (from laptop):**
```
wrangler deploy
```

**Automated via GitHub Actions:** push to `main` triggers `.github/workflows/deploy.yml`, which runs `wrangler deploy` using `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` from repository secrets. The workflow does NOT touch Worker secrets — those are managed manually via `wrangler secret put` and persist across deploys. Cloudflare maintains an official `cloudflare/wrangler-action` that wraps this nicely.

After deploy (one-time, or whenever the Worker URL changes), point Telegram at the webhook:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>&secret_token=<WEBHOOK_SECRET>
```

Verify with `getWebhookInfo`.

D1 migrations: `wrangler d1 migrations apply <DB_NAME>` (locally for dev DB, with `--remote` for production).

## Registering the Bot (one-time setup)

### 1. Create the bot with BotFather

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, follow the prompts (name + username ending in `_bot`)
3. Copy the `BOT_TOKEN` it gives you

### 2. Set Cloudflare Worker secrets

```powershell
wrangler secret put BOT_TOKEN        # paste the token from BotFather
wrangler secret put WEBHOOK_SECRET   # any random string, e.g.: openssl rand -hex 32
```

### 3. Get BOT_INFO and set it as a secret

```powershell
# Replace <TOKEN> with your actual bot token
curl "https://api.telegram.org/bot<TOKEN>/getMe"
# Copy the full JSON value of the "result" field, then:
wrangler secret put BOT_INFO         # paste the JSON string
```

### 4. Deploy the worker

```powershell
npm run deploy
```

### 5. Register the webhook with Telegram

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://split-money-bot.makoveichukvitalii.workers.dev&secret_token=<WEBHOOK_SECRET>
```

Verify it worked:
```
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### Re-registration needed when

- The Worker URL changes (custom domain, renamed worker)
- `WEBHOOK_SECRET` is rotated

## What NOT to Do

- Don't add Node-only dependencies. Check for `"node:"` imports or native modules before adding any package.
- Don't poll with `bot.start()` in production — it won't work on Workers (no long-running processes).
- Don't store large blobs in D1 — use R2 if media storage is ever needed.
- Don't put secrets in `wrangler.toml` — use `wrangler secret put`.
- Don't store runtime secrets (`BOT_TOKEN`, etc.) in GitHub Actions secrets. They belong in Cloudflare Worker secrets. GitHub only holds the Cloudflare API credentials needed for the workflow to deploy.
- Don't commit `.dev.vars` — it should be in `.gitignore`.
- Don't add an Express-style HTTP framework. The Worker's `fetch` handler + grammY's `webhookCallback` is the whole HTTP layer.
- Don't reach for KV unless the data is truly read-heavy and tolerates eventual consistency. D1 is the default.

## Useful References

- grammY docs: https://grammy.dev
- grammY on Cloudflare Workers: https://grammy.dev/hosting/cloudflare-workers-nodejs
- Cloudflare Workers docs: https://developers.cloudflare.com/workers/
- Cloudflare D1 docs: https://developers.cloudflare.com/d1/
- Telegram Bot API: https://core.telegram.org/bots/api
