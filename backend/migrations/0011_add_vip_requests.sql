-- Add VIP requests table
CREATE TABLE IF NOT EXISTS vip_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    discord_username TEXT,
    phone_number TEXT,
    screenshot_url TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    rejection_reason TEXT,
    FOREIGN KEY (user_id) REFERENCES players(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vip_requests_user_id ON vip_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_requests_status ON vip_requests(status);
