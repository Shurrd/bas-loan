# Lending app

Term loans and invoice financing, with a double-entry ledger. npm workspaces:

- `shared/` money, schedule and validation logic used by both ends
- `apps/server/` Express and SQLite (better-sqlite3)
- `apps/client/` Vite and React

## Run

```sh
npm install
npm run dev     # API on :3001, client on :5173 (proxies /api)
npm test        # shared, server and client tests
```

The SQLite file is created at `apps/server/data/lending.db` on first run, with the chart of accounts seeded. Set `DB_PATH` or `PORT` to change either. A database file made by an older version of the app is refused with a message. Delete it and restart.

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
