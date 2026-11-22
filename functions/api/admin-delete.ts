export type DeleteKind = 'sections' | 'schools' | 'projects';

/** يتحقق من قائمة المعرفات: مصفوفة غير فارغة من أعداد صحيحة موجزة بحد 200، بلا تكرار. */
export function parseDeleteIds(body: unknown): { valid: boolean; ids: number[] } {
  const raw = (body as { ids?: unknown } | null | undefined)?.ids;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return { valid: false, ids: [] };
  const ids: number[] = [];
  for (const item of raw) {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0) return { valid: false, ids: [] };
    if (!ids.includes(id)) ids.push(id);
  }
  return { valid: true, ids };
}

export interface DeleteData {
  sections: Array<{ id: number; name: string }>;
  schools: Array<{ id: number; name: string }>;
  projects: Array<{ id: number; name: string; section_id: number; school_id: number; section_name: string; school_name: string; written_votes: number }>;
  votes: Array<{ project_id: number; n: number }>;
}

export interface DeletePreviewResult {
  items: Array<{ id: number; name: string }>;
  projects: Array<{ id: number; name: string; context: string }>;
  votes: number;
}

/** يحسب ما سيُحذف بالضبط دون كتابة شيء: العناصر المختارة والمشاريع الساقطة معها وعدد الأصوات (إلكترونية وورقية). */
export function cascadePreview(kind: DeleteKind, ids: number[], data: DeleteData): DeletePreviewResult {
  const idSet = new Set(ids);
  const source = kind === 'sections' ? data.sections : kind === 'schools' ? data.schools : data.projects;
  const items = source.filter((row) => idSet.has(row.id)).map(({ id, name }) => ({ id, name }));
  const projects = data.projects.filter((project) =>
    kind === 'sections' ? idSet.has(project.section_id)
      : kind === 'schools' ? idSet.has(project.school_id)
        : idSet.has(project.id),
  );
  const projectIds = new Set(projects.map((project) => project.id));
  const digitalVotes = data.votes
    .filter((vote) => projectIds.has(vote.project_id))
    .reduce((total, vote) => total + vote.n, 0);
  const writtenVotes = projects.reduce((total, project) => total + (project.written_votes || 0), 0);
  return {
    items,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      context: `مدرسة ${project.school_name} / قسم ${project.section_name}`,
    })),
    votes: digitalVotes + writtenVotes,
  };
}

/**
 * يبني جمل الحذف بالترتيب الآمن للمفاتيح: أصوات ← فائزون ← فائز يدوي ← مشاريع ← أقسام/مدارس.
 * كل قائمة IN تُربط كـ JSON واحد (json_each) لأن D1 يحدّ كل عبارة بمئة معامل مربوط.
 */
export function buildDeleteStatements(kind: DeleteKind, ids: number[], projectIds: number[]): Array<{ sql: string; bind: string[] }> {
  const statements: Array<{ sql: string; bind: string[] }> = [];
  const sectionIds = kind === 'sections' ? ids : [];

  if (projectIds.length) {
    statements.push({
      sql: 'DELETE FROM votes WHERE project_id IN (SELECT value FROM json_each(?))',
      bind: [JSON.stringify(projectIds)],
    });
  }

  if (projectIds.length && sectionIds.length) {
    statements.push({
      sql: 'DELETE FROM section_winners WHERE project_id IN (SELECT value FROM json_each(?)) OR section_id IN (SELECT value FROM json_each(?))',
      bind: [JSON.stringify(projectIds), JSON.stringify(sectionIds)],
    });
  } else if (projectIds.length || sectionIds.length) {
    const byProject = Boolean(projectIds.length);
    const column = byProject ? 'project_id' : 'section_id';
    statements.push({
      sql: `DELETE FROM section_winners WHERE ${column} IN (SELECT value FROM json_each(?))`,
      bind: [JSON.stringify(byProject ? projectIds : sectionIds)],
    });
  }

  if (projectIds.length) {
    statements.push({
      sql: 'UPDATE result_settings SET manual_project_id = NULL WHERE manual_project_id IN (SELECT value FROM json_each(?))',
      bind: [JSON.stringify(projectIds)],
    });
  }

  if (kind === 'projects') {
    statements.push({ sql: 'DELETE FROM projects WHERE id IN (SELECT value FROM json_each(?))', bind: [JSON.stringify(ids)] });
  } else {
    if (projectIds.length) {
      const column = kind === 'sections' ? 'section_id' : 'school_id';
      statements.push({ sql: `DELETE FROM projects WHERE ${column} IN (SELECT value FROM json_each(?))`, bind: [JSON.stringify(ids)] });
    }
    statements.push({ sql: `DELETE FROM ${kind} WHERE id IN (SELECT value FROM json_each(?))`, bind: [JSON.stringify(ids)] });
  }
  return statements;
}
