CREATE TABLE splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Split',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finalized')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX splits_group_id ON splits (group_id, status);

CREATE TABLE split_participants (
  split_id INTEGER NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (split_id, user_id)
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  split_id INTEGER NOT NULL REFERENCES splits(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX expenses_split_id ON expenses (split_id);
