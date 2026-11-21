CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sections (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE schools (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, logo_image_id INTEGER REFERENCES images(id));
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_id INTEGER REFERENCES images(id),
  image_url TEXT,
  url TEXT,
  section_id INTEGER NOT NULL REFERENCES sections(id),
  school_id INTEGER NOT NULL REFERENCES schools(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (id, section_id)
);
CREATE INDEX idx_projects_section ON projects(section_id);
CREATE TABLE voters (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  father_name TEXT NOT NULL,
  grandfather_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('qr','tablet')),
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  voided INTEGER NOT NULL DEFAULT 0,
  void_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_voters_normalized ON voters(normalized_name);
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voter_id TEXT NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  UNIQUE (voter_id, section_id),
  FOREIGN KEY (project_id, section_id) REFERENCES projects(id, section_id)
);
CREATE INDEX idx_votes_project ON votes(project_id);
CREATE TRIGGER trg_votes_max3 BEFORE INSERT ON votes
WHEN (SELECT COUNT(*) FROM votes WHERE voter_id = NEW.voter_id) >= 3
BEGIN SELECT RAISE(ABORT, 'MAX_3_VOTES'); END;
CREATE TABLE section_winners (
  section_id INTEGER PRIMARY KEY REFERENCES sections(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE login_attempts (
  ip TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip, attempted_at);
