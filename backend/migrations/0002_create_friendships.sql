
-- Migration number: 0002 	 2024-05-22T12:00:00.000Z
CREATE TABLE friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id1 TEXT NOT NULL,
    user_id2 TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id1) REFERENCES players(id),
    FOREIGN KEY (user_id2) REFERENCES players(id)
);

CREATE INDEX idx_friendships_user1 ON friendships(user_id1);
CREATE INDEX idx_friendships_user2 ON friendships(user_id2);
