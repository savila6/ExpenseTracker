# ExpenseTracker

Personal spending tracker for **Itaú Uruguay** customers. Itaú emails a notice
("Aviso de consumo aprobado con tarjeta de débito") for every card payment, including Apple Pay.
ExpenseTracker reads those emails from Gmail, extracts the merchant, amount, currency, date and card,
auto-categorizes each payment, and shows monthly budgets and spending metrics.

- **Gmail sync (primary):** read-only OAuth, query `from:comunicaciones@itau.com.uy`, incremental
  import deduplicated by Gmail message id and `Message-ID`, a **Sincronizar ahora** button, and a
  background poll every 5 minutes while the server runs.
- **Manual import (secondary):** paste the email text (or its full source) or upload `.eml` files.
- **Categories:** Supermercado, Restaurantes, Transporte, Combustible, Salud, Entretenimiento,
  Servicios, Compras, Otros. Keyword rules are tuned for Montevideo merchants. Changing a
  transaction's category saves a merchant rule that re-labels past and future payments from
  that merchant.
- **Budgets:** a monthly limit per category, with progress and overspend warnings.
- **Dashboard:** monthly total versus the previous month, a breakdown by category, top merchants,
  a 6-month trend, and a filterable transaction list.
- **Local-first:** a single SQLite file in `data/` (via Node's built-in `node:sqlite`). No account
  and no cloud database. The app is seeded with demo data until you clear it.

Stack: Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, shadcn/ui, Recharts, Vitest.

## Run it

Requires **Node.js 22.13+** (for `node:sqlite`).

```bash
npm install
cp .env.example .env.local   # optional: only needed for Gmail sync
npm run dev                  # http://localhost:4317
```

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Dev server on port 4317             |
| `npm test`          | Parser, categorizer, metrics, ingestion and Gmail sync tests |
| `npm run typecheck` | TypeScript                          |
| `npm run build && npm start` | Production build on port 4317 |

To reset all local data, stop the server and delete `data/`. Demo data is re-seeded on the next
start; set `SEED_DEMO_DATA=false` to start empty.

## Connecting Gmail

Without `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, the app still runs: it shows demo data, and
the Importar page shows these setup steps instead of an error.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g.
   "ExpenseTracker").
2. **APIs & Services → Library**: search for **Gmail API** and click **Enable**.
3. **APIs & Services → OAuth consent screen** (shown as "Google Auth Platform" in newer consoles):
   - User type: **External**. App name: ExpenseTracker. Use your own email for the support and
     developer contact fields.
   - **Data access / Scopes**: add `https://www.googleapis.com/auth/gmail.readonly`.
   - **Audience / Test users**: add the Gmail address that receives the Itaú emails.
   - Leave the app in **Testing**; you don't need Google verification for personal use. Note
     that refresh tokens for apps in Testing **expire after 7 days**. When that happens the app
     shows "Volvé a conectar Gmail" and you click Connect again. To avoid weekly reconnects,
     publish the app ("In production"); for personal use you can accept the "unverified app"
     warning.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URI: `http://localhost:4317/api/gmail/callback`. If you run on another
     host or port, use `${APP_URL}/api/gmail/callback` and set `APP_URL` to match.
5. Copy the **Client ID** and **Client secret** into `.env.local` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, then restart `npm run dev`.
6. In the app, go to **Importar → Conectar Gmail** and approve read-only access. The first sync
   imports the last 90 days (`GMAIL_INITIAL_LOOKBACK_DAYS`); after that, only new messages are
   fetched.

Tokens are stored only in the local SQLite file. **Desconectar** revokes them with Google.

## How the parser works

`src/lib/parser/itau.ts` is transport-agnostic: it takes an `EmailMessage` (`subject`, `from`,
`date`, `html`, `text`) and returns either a payment or a reason it was skipped.

The reference format comes from a real notice (redacted fixture in
`src/lib/parser/__fixtures__/itau-debit-visa-uyu.eml`):

> Se aprobo un consumo de su tarjeta Visa terminada en 0000 . Realizado en FROG VIS3 Monto: 90.29 Pesos.

- **Merchant:** the text between "Realizado en" and "Monto".
- **Amount:** `90.29` is read with a dot as the decimal separator. `1.234,56` and `1,234.56` are
  both accepted; whichever separator is followed by 1–2 trailing digits is the decimal one.
- **Currency:** "Pesos", `$` or `UYU` → UYU; "Dólares", `U$S`, `US$` or `USD` → USD. If none is
  present it assumes UYU and logs a warning.
- **Card:** the brand and last 4 digits come from "tarjeta … terminada en NNNN". Débito or crédito
  comes from the subject.
- **Date:** the notice has no date in its body, so the email's `Date` header is used and converted
  to the America/Montevideo calendar day. If a future template includes `dd/mm/yyyy [hh:mm]` in the
  body, that date takes precedence.
- **Skipped:** subjects or bodies mentioning rechazado, denegado, devolución, anulación or reintegro,
  and emails with no payment wording (e.g. promotions from the same sender). These are logged as
  "Ignorado". Emails that look like payments but don't match any pattern are logged as
  "No reconocido" so a format change is visible.

To support a new template, add a regex to `BODY_PATTERNS` and a test in
`src/lib/parser/itau.test.ts`.

## Architecture

```
src/lib/parser/       itau.ts (notice → payment), eml.ts (RFC 822 / pasted text → EmailMessage)
src/lib/ingestion/    types.ts (EmailSource interface), ingest.ts (parse + categorize + dedupe + store),
                      gmail.ts (OAuth + Gmail REST source), poller.ts (background sync)
src/lib/categorize.ts keyword map + user merchant rules
src/lib/metrics.ts    dashboard aggregations (pure)
src/lib/db.ts, repo.ts SQLite schema and queries
src/instrumentation.ts starts the Gmail poller when the Node server boots
```

To add another mailbox (e.g. Outlook via Microsoft Graph), implement `EmailSource` and feed each
message to `ingestEmail` with a stable `sourceKey`. Parsing, categorization and dedupe are shared.

Amounts in USD are converted to UYU for totals and budgets using the rate set on the
Presupuestos page (default 40).
