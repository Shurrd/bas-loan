# Lending app

Term loans and invoice financing, with a double-entry ledger. npm workspaces:

- `shared/` money, schedule and validation logic used by both ends
- `apps/server/` Express and SQLite (better-sqlite3)
- `apps/client/` Vite and React

## Features

**Term loans**

- Quote a loan from a principal, annual rate, term in months and disbursement date, and see the full repayment schedule. It is the reducing-balance annuity from the brief, rounded half-up only where the brief names, and the last instalment clears the balance.
- Approve a saved quote to disburse it. One quote creates one loan, so a double click or a retry cannot disburse twice.
- Record a repayment. The server previews how it is allocated: oldest due instalment first, then penalty, fee, interest and principal, with any surplus going to Unapplied Credit. Confirming posts exactly that allocation, and is refused if the loan changed since the preview.
- Open a loan to see its schedule with paid state, its journal entries, and a statement built from its ledger lines with a running principal balance.
- A tie-out compares the statement's closing balance with the principal outstanding on the schedule. It shows a match, or turns red with the difference in kobo and naira.
- Download the statement as a PDF.

**Invoice financing**

- Quote an invoice from a face value, tenor in days and funding date: advance (80%), reserve, discount fee (36% a year on actual days over 365) and due date.
- Fund a saved quote to post the advance. One quote creates one invoice.
- Settle an invoice with only a settlement date, since the debtor always pays the face value. The server previews and then posts the late penalty (0.2% of the advance a day) and either the amount payable to the client or the shortfall the client owes. Payable is never shown below zero, and an invoice settles once.

**Ledger**

- A double-entry journal that cannot be edited or deleted. Every entry balances, links to its loan or invoice, and never posts a zero line.
- Reversing an entry is built and tested on the server. There is no screen for it yet.

**Across the app**

- Lists of loans and invoices, newest first, with an eye on each row to open it. New loan and New invoice open as modals.
- Money crosses the wire as strings and all money maths uses BigInt. The browser also works out its own preview from the same code, and blocks approval if it differs from the server's quote by a single kobo.
- Every posting action is idempotent: the same key and body returns the original result, and the same key with a different body returns 409.
- Both ends validate. Server errors show against the right field, and a server outage shows as a toast.
- Amounts are typed with thousands separators, dates are picked from a calendar, and dropdowns can be searched.
- A Docker image and Fly.io config are included to deploy it as one app.

## Run

```sh
npm install
npm run dev     # API on :3001, client on :5173 (proxies /api)
npm test        # shared, server and client tests
```

The SQLite file is created at `apps/server/data/lending.db` on first run, with the chart of accounts seeded. Set `DB_PATH` or `PORT` to change either. A database file made by an older version of the app is refused with a message. Delete it and restart.

## Deploy

The app runs as one container: the server also serves the built client. The database is a SQLite file, so it needs a persistent volume and a single machine. A `Dockerfile` and a `fly.toml` for Fly.io are included.

```sh
fly launch --copy-config --no-deploy   # uses the included fly.toml and Dockerfile
fly volumes create lending_data --region ams --size 1
fly deploy
fly scale count 1
```

To try the same image locally:

```sh
docker build -t lending .
docker run -p 8080:8080 -v lending-data:/data lending   # http://localhost:8080
```

The server reads `PORT`, `DB_PATH` and `CLIENT_DIR` (a built client to serve). The Dockerfile sets them for the container. There is no login, so anyone with the URL can use the app.

## API

Kobo is always a string of digits, for example `"120000000"` for ₦1,200,000.00. Rates are decimal strings such as `"18.75"`. Dates are `YYYY-MM-DD`. Validation errors are `400 { "errors": [{ "field", "message" }] }`. Other errors are `{ "message" }`. Every route that posts needs an `Idempotency-Key` header (8 to 128 of `A-Za-z0-9_-`). The same key and body returns the original response with `Idempotent-Replayed: true`. The same key with a different body returns `409`.

| Method | Path                                   | Notes                                                                                                                                                                                                                                                                                                                   |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/loans/quote`                     | Body `{ principal, annualRatePercent, termMonths, disbursementDate }`. Saves the terms and schedule and returns `201 { quoteId, schedule, totalInterest }`. Posts nothing.                                                                                                                                              |
| POST   | `/api/loans`                           | Body `{ quoteId }`. Uses the saved terms, never terms from the client. Creates the loan, its instalments and the disbursement entry in one transaction and returns `201 { loan, schedule, entries }`. A quote that already has a loan returns `409 { message, loanId }` and posts nothing.                              |
| GET    | `/api/loans`                           | Returns the newest 100 loans as `[{ id, principal, annualRatePercent, termMonths, disbursementDate, outstandingPrincipal }]`, newest first. `outstandingPrincipal` comes from instalment state.                                                                                                                         |
| GET    | `/api/loans/:id`                       | Returns `{ loan, schedule, entries }`. Each instalment carries its due and paid amounts.                                                                                                                                                                                                                                |
| GET    | `/api/loans/:id/statement`             | Returns `{ lines, closingBalance, tieOut }`. `lines` come from the loan's journal lines only, each with a running principal balance. `tieOut` compares the closing balance with outstanding principal from instalment state: `{ outstandingPrincipal, difference, matches }`.                                           |
| GET    | `/api/loans/:id/statement.pdf`         | The same statement and tie-out as an A4 PDF, sent as an attachment named `loan-<id>-statement.pdf`. Built on the server, with the logo and Inter embedded.                                                                                                                                                              |
| POST   | `/api/loans/:id/payments/preview`      | Body `{ amount, paymentDate }`. Returns `{ stateVersion, allocation }` computed by the server. Posts nothing.                                                                                                                                                                                                           |
| POST   | `/api/loans/:id/payments`              | Body `{ amount, paymentDate, stateVersion }`. Recomputes the allocation on the server and posts it with the instalment paid amounts in one transaction. Returns `201 { stateVersion, allocation, entry }`. If the loan changed since the preview it returns `409 { message, code: "STATE_CHANGED" }` and posts nothing. |
| POST   | `/api/invoices/quote`                  | Body `{ faceValue, tenorDays, fundingDate }`. Saves the quote and returns `201 { quoteId, faceValue, tenorDays, fundingDate, dueDate, advance, reserve, fee }`. Posts nothing.                                                                                                                                          |
| POST   | `/api/invoices`                        | Body `{ quoteId }`. Funds the invoice from the saved quote and posts the advance entry. Returns `201 { invoice, settlement, entries }`. A quote already funded returns `409 { message, invoiceId }`.                                                                                                                    |
| GET    | `/api/invoices`                        | Returns the newest 100 invoices as `[{ id, faceValue, tenorDays, fundingDate, dueDate, advance, reserve, fee, settled }]`, newest first.                                                                                                                                                                                |
| GET    | `/api/invoices/:id`                    | Returns `{ invoice, settlement, entries }`. `settlement` is `null` until the invoice is settled.                                                                                                                                                                                                                        |
| POST   | `/api/invoices/:id/settlement/preview` | Body `{ settlementDate }`. Returns `{ settlement }` with days overdue, penalty, `payableToClient` and `shortfall`, worked out by the server. Posts nothing.                                                                                                                                                             |
| POST   | `/api/invoices/:id/settlement`         | Body `{ settlementDate }`. The debtor always pays the face value, so there is no amount. Recomputes and posts the settlement. Returns `201 { settlement, entry }`. A second settlement returns `409 { message, code: "ALREADY_SETTLED", invoiceId }`.                                                                   |
