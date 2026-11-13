CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  merchant TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total > 0),
  mode TEXT NOT NULL CHECK (mode IN ('demo', 'testnet')),
  recipient TEXT,
  created INTEGER NOT NULL
);
CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  invoice TEXT NOT NULL REFERENCES invoices(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  route TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'confirmed', 'failed')),
  created INTEGER NOT NULL,
  proof TEXT UNIQUE,
  sender TEXT
);
CREATE UNIQUE INDEX one_pending ON attempts(invoice) WHERE state = 'pending';
CREATE INDEX attempts_invoice ON attempts(invoice);
