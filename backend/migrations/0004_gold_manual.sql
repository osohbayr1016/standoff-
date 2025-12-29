ALTER TABLE players ADD COLUMN gold INTEGER NOT NULL DEFAULT 0;
CREATE TABLE gold_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES players(id),
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT REFERENCES players(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_gold_trans_user ON gold_transactions(user_id);
CREATE INDEX idx_gold_trans_seller ON gold_transactions(created_by);
