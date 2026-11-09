# Notes

## Money on the wire

Kobo and rates go as strings, such as "120000000" and "18.75". A JSON number is a double and loses precision above 2^53 kobo. Strings parse into BigInt and exact fractions, so no float touches money.

## Shared logic

Client and server share one implementation in `shared`. The parity test checks the brief's invariants and every instalment against an independent high-precision reference. The client also previews from the same code and compares with the server quote. A differing kobo blocks approval.

## How the flows work

Approval sends only a saved `quoteId`, and one quote creates one loan or invoice. Each action reuses one idempotency key on retry. Confirming a payment recomputes the allocation and returns 409 if the loan's state version moved since the preview. The statement uses journal lines only, outstanding principal uses instalment state only, and the tie-out compares them. The statement downloads as a PDF built on the server.

## Assumptions

- The first instalment is due one month after disbursement, clamped to month end.
- Term loans have no penalty or fee rates yet. The waterfall supports both, and they are 0. A 0% rate is accepted.
- What is left after the instalments due by the payment date goes to Unapplied Credit. It does not reduce principal and is not applied later.
- The invoice fee uses the agreed tenor, including on early settlement. The 96-days-overdue example only shows that overdue days do not extend it. The 80%, 36% and 0.2% rates are constants.
- SQLite has no deferred constraints, so balance checks run in the posting transaction. Triggers make the journal append-only.
- A reversed disbursement cannot be posted again, since one disbursement per loan is a unique index.
- The statement lists every ledger line of the loan, by date then entry. Tie-out difference is statement balance minus schedule outstanding.
- A loan shows as Repaid when its outstanding principal is 0. Lists show the newest 100 records.
- Naira input allows two decimals. The calendar shows dd/MM/yyyy, while state and the wire use YYYY-MM-DD.
- On large loans the last instalment can differ by more than a few kobo (worst found: 141).

## Input limits (mine, the brief gives none)

- Principal and payment amounts: up to 9,223,372,036,854,775,807 kobo, the most SQLite stores.
- Rate: 0 to 100 with at most 4 decimals. Term: 1 to 120 months.
- Invoice face value up to ₦1 trillion, tenor 1 to 365 days, funding and settlement dates up to 2100-12-31. The calendar offers 2000 to 2100.

## Open questions

- Early payoff. I follow Section 2 literally, so paying the full balance before the due dates does not close the loan. Allocation is one function, so a payoff rule can go there.
- Early settlement of an invoice. I charge the full tenor fee. The brief does not say whether to cut it to the days outstanding.

## What I verified by hand

## Not finished

- Reversal has a function and tests but no endpoint or UI.
