CREATE TABLE IF NOT EXISTS accounts (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'income'))
);

CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY,
    principal INTEGER NOT NULL CHECK (principal > 0),
    annual_rate TEXT NOT NULL,
    term_months INTEGER NOT NULL CHECK (term_months > 0),
    disbursement_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY,
    face_value INTEGER NOT NULL CHECK (face_value > 0),
    tenor_days INTEGER NOT NULL CHECK (tenor_days >= 0),
    advance_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (
        kind IN ('disbursement', 'payment', 'invoice_advance', 'invoice_settlement', 'reversal')
    ),
    entry_date TEXT NOT NULL,
    loan_id INTEGER REFERENCES loans (id),
    invoice_id INTEGER REFERENCES invoices (id),
    reverses_entry_id INTEGER UNIQUE REFERENCES journal_entries (id),
    posted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((loan_id IS NULL) <> (invoice_id IS NULL)),
    CHECK (kind NOT IN ('disbursement', 'payment') OR loan_id IS NOT NULL),
    CHECK (kind NOT IN ('invoice_advance', 'invoice_settlement') OR invoice_id IS NOT NULL),
    CHECK ((kind = 'reversal') = (reverses_entry_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id INTEGER PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES journal_entries (id),
    account_code TEXT NOT NULL REFERENCES accounts (code),
    side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    loan_id INTEGER REFERENCES loans (id),
    invoice_id INTEGER REFERENCES invoices (id),
    CHECK ((loan_id IS NULL) <> (invoice_id IS NULL))
);

CREATE INDEX IF NOT EXISTS journal_lines_entry ON journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_loan ON journal_lines (loan_id, account_code);
CREATE INDEX IF NOT EXISTS journal_lines_invoice ON journal_lines (invoice_id);

-- A second disbursement, advance or settlement is rejected whatever idempotency key it carries
CREATE UNIQUE INDEX IF NOT EXISTS one_disbursement_per_loan
    ON journal_entries (loan_id) WHERE kind = 'disbursement';
CREATE UNIQUE INDEX IF NOT EXISTS one_advance_per_invoice
    ON journal_entries (invoice_id) WHERE kind = 'invoice_advance';
CREATE UNIQUE INDEX IF NOT EXISTS one_settlement_per_invoice
    ON journal_entries (invoice_id) WHERE kind = 'invoice_settlement';

CREATE TRIGGER IF NOT EXISTS journal_entries_no_update BEFORE UPDATE ON journal_entries
BEGIN
    SELECT RAISE(ABORT, 'journal_entries is append-only');
END;

CREATE TRIGGER IF NOT EXISTS journal_entries_no_delete BEFORE DELETE ON journal_entries
BEGIN
    SELECT RAISE(ABORT, 'journal_entries is append-only');
END;

CREATE TRIGGER IF NOT EXISTS journal_lines_no_update BEFORE UPDATE ON journal_lines
BEGIN
    SELECT RAISE(ABORT, 'journal_lines is append-only');
END;

CREATE TRIGGER IF NOT EXISTS journal_lines_no_delete BEFORE DELETE ON journal_lines
BEGIN
    SELECT RAISE(ABORT, 'journal_lines is append-only');
END;

-- A line must point at the same loan or invoice as its entry
CREATE TRIGGER IF NOT EXISTS journal_lines_match_entry BEFORE INSERT ON journal_lines
WHEN NOT EXISTS (
    SELECT 1 FROM journal_entries e
    WHERE e.id = NEW.entry_id AND e.loan_id IS NEW.loan_id AND e.invoice_id IS NEW.invoice_id
)
BEGIN
    SELECT RAISE(ABORT, 'journal line does not match its entry');
END;
