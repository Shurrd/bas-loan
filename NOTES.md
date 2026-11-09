# Notes

## Money on the wire
I send kobo as decimal strings and rates as decimal strings like "18.75". A JSON number is a double, and anything above 2^53 kobo (about ₦90 trillion) loses precision. The brief's top principal of ₦5bn is fine as a double, but intermediate products are not, and I did not want a rule that only holds inside a range. Strings parse straight into BigInt on both sides. Rates are parsed into exact fractions, so no float is involved at any step.

## Shared logic
The client and server use one implementation in `packages/shared`. Because of that, the parity test checks invariants and compares against an independent reference, rather than client against server.

## Assumptions
- The first instalment is due one month after disbursement. Later dates are counted from the disbursement day and clamped to month end, so 31 Jan gives 28 Feb, then 31 Mar.
- Term loans have no penalty or fee rates yet. The waterfall supports both, and they are 0.
- A repayment has a payment date. Whatever is left after the instalments due by that date go to Unapplied Credit. It does not reduce principal and is not applied later.
- A 0% annual rate is accepted and splits the principal evenly.
- Invoice rates (80% advance, 36% discount, 0.2% per day penalty) are constants at the top of `invoice.ts`. The fee uses the agreed tenor, not the days actually outstanding.

## What I verified by hand


## Not finished
- Server, database, ledger and all screens. Only `packages/shared` exists so far.
- Early payoff. The brief says the hidden tests cover it, but it is not described in the domain rules.
