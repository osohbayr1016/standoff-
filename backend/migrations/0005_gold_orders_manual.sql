CREATE TABLE gold_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES players(id),
    gold_amount INTEGER NOT NULL,
    price_mnt INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    proof_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    processed_by TEXT REFERENCES players(id)
);
CREATE INDEX idx_gold_orders_user ON gold_orders(user_id);
CREATE INDEX idx_gold_orders_status ON gold_orders(status);
