# Notes

## Money on the wire

I send kobo as decimal strings and rates as decimal strings like "18.75". A JSON number is a double, and anything above 2^53 kobo (about ₦90 trillion) loses precision. The brief's top principal of ₦5bn is fine as a double, but intermediate products are not, and I did not want a rule that only holds inside a range. Strings parse straight into BigInt on both sides. Rates are parsed into exact fractions, so no float is involved at any step.

## Shared logic

The client and server use one implementation in `shared`. Because of that, the parity test checks invariants and compares against an independent reference, rather than client against server.

## Assumptions

- The first instalment is due one month after disbursement. Later dates are counted from the disbursement day and clamped to month end, so 31 Jan gives 28 Feb, then 31 Mar.
- Term loans have no penalty or fee rates yet. The waterfall supports both, and they are 0.
- A repayment has a payment date. Whatever is left after the instalments due by that date go to Unapplied Credit. It does not reduce principal and is not applied later.
- A 0% annual rate is accepted and splits the principal evenly.
- Invoice rates (80% advance, 36% discount, 0.2% per day penalty) are constants in `shared/src/lib/constant.ts`.
- The invoice fee uses the agreed tenor, including when an invoice settles early. That is an assumption. The 96-days-overdue example only shows that overdue days do not extend the fee.
- The ledger keeps the journal append-only with SQLite triggers. SQLite has no deferred constraints, so the two-line and balance checks run inside the posting transaction and roll the entry back, not in the schema.
- A loan has one disbursement and an invoice one advance and one settlement, enforced by partial unique indexes. A reversed disbursement therefore cannot be posted again.
- The last instalment can differ from the others by more than a few kobo on large loans. In my scan the worst was 141 kobo, at about ₦1.2bn, 55% and 60 months.

## Open questions

- Early payoff. I follow Section 2 literally: a repayment only clears instalments due by the payment date, and the rest goes to Unapplied Credit without reducing principal. So paying the full balance before the due dates does not close the loan. The brief says hidden tests cover early payoff but never defines it. Allocation lives in one function, so a payoff rule can be added there if the hiring contact clarifies it.

- Early settlement of an invoice. I charge the fee for the full agreed tenor even when the debtor pays before the due date. The brief does not say whether the fee should be cut to the days actually outstanding.

## What I verified by hand

## Not finished

- The server has the schema, ledger and posting rules only. No routes, idempotency, repayment allocation or screens yet.
- Reversal has a function and tests but no endpoint or UI.
