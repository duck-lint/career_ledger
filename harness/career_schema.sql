-- Initial SQLite source-of-truth schema; no derived semantic taxonomy.
PRAGMA foreign_keys = ON;

CREATE TABLE experience_records (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('employment', 'project')),
    title TEXT NOT NULL,
    organization TEXT,
    start_date TEXT,
    end_date TEXT
);

CREATE TABLE evidence_items (
    id TEXT PRIMARY KEY,
    experience_id TEXT NOT NULL REFERENCES experience_records(id),
    description TEXT NOT NULL
);

CREATE TABLE approved_content (
    id TEXT PRIMARY KEY,
    section TEXT NOT NULL CHECK (section IN ('profile', 'highlight', 'education', 'certification', 'toolkit')),
    content TEXT NOT NULL
);
