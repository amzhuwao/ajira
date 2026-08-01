# Ajira

Freelance marketplace with escrow, built on **Next.js 15**. Buyers fund work through **Paynow** (web checkout, Ecocash, OneMoney). Sellers earn into an internal wallet; withdrawals are admin-approved manual payouts.

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma + SQLite locally (use PostgreSQL in production by changing the datasource)
- Auth.js credentials sessions
- Tailwind CSS
- Paynow Node SDK (`paynow`)

## Setup

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed accounts

| Email | Password | Role |
|-------|----------|------|
| admin@ajira.local | password123 | ADMIN |
| buyer@ajira.local | password123 | BUYER |
| seller@ajira.local | password123 | SELLER |

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma connection (`file:./dev.db` locally) |
| `AUTH_SECRET` | Auth.js secret (long random string) |
| `AUTH_URL` / `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` | App base URL |
| `PAYNOW_INTEGRATION_ID` | Paynow integration ID |
| `PAYNOW_INTEGRATION_KEY` | Paynow integration key |
| `PAYNOW_RESULT_URL` | Webhook: `/api/paynow/result` |
| `PAYNOW_RETURN_URL` | Browser return after payment |

Docs: [Paynow Node.js quickstart](https://developers.paynow.co.zw/docs/paynow/nodejs_quickstart/).

### Production database (PostgreSQL)

1. Change `provider` in `prisma/schema.prisma` to `postgresql`
2. Set `DATABASE_URL` to your Postgres URL
3. Run `npx prisma migrate dev`

## Escrow flow

1. Buyer posts project → sellers bid → buyer accepts → escrow `PENDING`
2. Buyer funds via Paynow → result URL + poll → `FUNDED`
3. Seller marks delivered → buyer approves → wallet credit → `RELEASED`
4. Seller requests withdrawal → admin pays out manually → marks completed
5. Disputes: open from funded escrow → admin release or mark refunded

## Paynow notes

- **Inbound only.** Funds land in the platform merchant account (no Connect-style seller split).
- **Refunds.** Admin “mark refunded” updates the ledger only — reverse the payment in the Paynow merchant portal.
- **Result URL** + poll are the source of truth; the return page is UX only.
- Amounts are **USD** (two decimals).

## Scripts

```bash
npm run dev       # Dev server
npm run build     # Production build
npm run db:push   # Sync schema
npm run db:seed   # Demo users
npm run lint
```
