# Welth — Finance Platform

## Project Overview
Full-stack personal finance app. Users manage multiple accounts, log transactions (manual, receipt scan, or voice), set budgets, and view dashboards with charts. Recurring transactions run automatically via background jobs.

## Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (Turbopack) |
| UI | React 19, TailwindCSS v3, shadcn/ui |
| Database | PostgreSQL via Supabase (Prisma 6 ORM) |
| Auth | Clerk (`@clerk/nextjs`) |
| AI — receipts | Google Gemini (`@google/generative-ai`) |
| AI — voice | Groq Whisper + Google Gemini |
| Rate limiting | ArcJet (`@arcjet/next`) |
| Background jobs | Inngest |
| Email | Resend + Nodemailer |
| Toast | Sonner |
| Forms | react-hook-form + Zod |
| Icons | lucide-react |

## Project Structure
```
app/
  (auth)/            # sign-in, sign-up (Clerk hosted)
  (main)/
    dashboard/       # overview, account cards, budget progress
    account/[id]/    # per-account transaction table + chart
    transaction/
      create/        # add / edit transaction page
      _components/   # AddTransactionForm, ReceiptScanner
  api/
    inngest/         # background job handler
    voice-transcribe/ # Groq Whisper transcription endpoint
actions/             # Next.js Server Actions ("use server")
  dashboard.js       # getUserAccounts, getDashboardData, createAccount
  transaction.js     # createTransaction, updateTransaction, scanReceipt
  account.js         # getAccountWithTransactions, bulkDeleteTransactions
  voice.js           # extractVoiceTransactions (Gemini)
  budget.js          # getCurrentBudget, updateBudget
components/
  voice-transaction.jsx   # Voice AI feature (mic → transcribe → extract → review → save)
  ui/                     # shadcn/ui primitives
data/
  categories.js      # 21 default transaction categories (INCOME + EXPENSE)
hooks/
  use-fetch.js       # generic async hook wrapping server actions
lib/
  prisma.js          # Prisma client singleton
  arcjet.js          # token-bucket rate limiter (10 req/hr per user)
  balance.js         # recalculateBalancesFromDate — recomputes balanceAfter
prisma/
  schema.prisma      # DB schema
```

## Key Patterns

### Server Actions
All data mutations go through `"use server"` files in `actions/`. Client components import and call them directly — Next.js creates RPC stubs automatically.

### Decimal Serialization (IMPORTANT)
Prisma uses `Decimal` objects for `amount`, `balance`, `initialBalance`, `balanceAfter`. These must be converted to plain numbers before crossing the Server→Client boundary. Every serializer must handle:
```js
if (obj.amount != null)      out.amount      = obj.amount?.toNumber?.()      ?? obj.amount;
if (obj.balanceAfter != null) out.balanceAfter = obj.balanceAfter?.toNumber?.() ?? obj.balanceAfter;
if (obj.balance != null)     out.balance     = obj.balance?.toNumber?.()     ?? obj.balance;
if (obj.initialBalance != null) out.initialBalance = obj.initialBalance?.toNumber?.() ?? obj.initialBalance;
```
Missing any field → `Decimal objects are not supported` crash on the client.

### Balance Recalculation
`lib/balance.js → recalculateBalancesFromDate(accountId, date, tx)` replays ALL transactions from `date` forward in chronological order and updates `balanceAfter` on each. Called inside a DB transaction after any create/update/delete.

### ArcJet Rate Limiting
- `lib/arcjet.js` — token bucket (10 req/hr) used by `createTransaction`
- `middleware.js` — shield + detectBot on all routes; Clerk auth on protected routes

### Voice Transaction Feature
1. Browser records audio via `MediaRecorder` (`components/voice-transaction.jsx`)
2. Audio uploaded to `POST /api/voice-transcribe` → Groq Whisper → transcript
3. Transcript sent to `extractVoiceTransactions()` server action → Gemini → JSON array
4. User reviews/edits transactions in UI
5. "Create All" calls `createTransaction()` for each in **reverse order** (so first-spoken appears first in the `createdAt DESC` sorted table)

### Transaction Rules
- `date` must not be in the future (enforced in `createTransaction` server action + voice AI prompt)
- `amount` must be > 0
- `category` must match a valid category ID from `data/categories.js`

## Environment Variables
```
DATABASE_URL          # Supabase PostgreSQL (connection pooler)
DIRECT_URL            # Supabase PostgreSQL (direct, for migrations)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
GEMINI_API_KEY        # Google Generative AI (receipts + voice extraction)
GROQ_API_KEY          # Groq (Whisper speech-to-text)
RESEND_API_KEY        # Transactional email
ARCJET_KEY            # ArcJet rate limiting
GMAIL_USER            # Nodemailer fallback
GMAIL_APP_PASSWORD
```

## Categories
21 categories in `data/categories.js`. IDs are kebab-case strings used as the `category` field in transactions:
- **INCOME**: `salary`, `freelance`, `investments`, `business`, `rental`, `other-income`
- **EXPENSE**: `housing`, `transportation`, `groceries`, `utilities`, `entertainment`, `food`, `shopping`, `healthcare`, `education`, `personal`, `travel`, `insurance`, `gifts`, `bills`, `other-expense`

## Common Gotchas
- **Don't use `middleware.js`** — Next.js 16 deprecated it in favor of `proxy.js` (warning at build time, still functional)
- **Always serialize Decimals** before returning from any server action
- **ArcJet in dev** uses `127.0.0.1` and logs a warning — expected, not an error
- **Clerk in dev** hits rate limits on their hosted API — intermittent `fetch failed` errors are network flakiness, not bugs
- The `(main)` route group does NOT appear in the URL — `/transaction/create` is the path, not `/(main)/transaction/create`
