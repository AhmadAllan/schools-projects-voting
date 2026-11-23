-- 0003: أصوات حرة — إلغاء قيد «صوت واحد لكل قسم» مع الحفاظ على حد 3 أصوات
DROP TRIGGER IF EXISTS trg_votes_max3;
CREATE TABLE votes_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  voter_id   TEXT NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  UNIQUE (voter_id, project_id),
  FOREIGN KEY (project_id, section_id) REFERENCES projects(id, section_id)
);
INSERT INTO votes_new (id, voter_id, section_id, project_id)
  SELECT id, voter_id, section_id, project_id FROM votes ORDER BY id;
DROP TABLE votes;
ALTER TABLE votes_new RENAME TO votes;
CREATE INDEX idx_votes_project ON votes(project_id);
CREATE TRIGGER trg_votes_max3
  BEFORE INSERT ON votes
  WHEN (SELECT COUNT(*) FROM votes WHERE voter_id = NEW.voter_id) >= 3
  BEGIN
    SELECT RAISE(ABORT, 'MAX_3_VOTES');
  END;
