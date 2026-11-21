ALTER TABLE projects ADD COLUMN written_votes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN announce_in_results INTEGER NOT NULL DEFAULT 1;

CREATE TABLE result_settings (
  scope TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('digital','written','combined','manual')),
  manual_project_id INTEGER REFERENCES projects(id)
);

INSERT OR IGNORE INTO result_settings(scope, source) VALUES ('global', 'digital');
