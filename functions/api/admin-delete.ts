export type DeleteKind = 'sections' | 'schools' | 'projects';

/** يتحقق من قائمة المعرفات: مصفوفة غير فارغة من أعداد صحيحة موجبة بحد 200، بلا تكرار. */
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
  projects: Array<{ id: number; name: string; section_id: number; school_id: number; section_name: string; school_name: string }>;
  votes: Array<{ project_id: number }>;
  winners: Array<{ section_id: number; project_id: number }>;
  manualProjectId: number | null;
}

export interface DeletePreviewResult {
  items: Array<{ id: number; name: string }>;
  projects: Array<{ id: number; name: string; context: string }>;
  votes: number;
}

/** يحسب ما سيُحذف بالضبط دون كتابة شيء: العناصر المختارة والمشاريع الساقطة معها وعدد الأصوات. */
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
  const votes = data.votes.filter((vote) => projectIds.has(vote.project_id)).length;
  return {
    items,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      context: `مدرسة ${project.school_name} / قسم ${project.section_name}`,
    })),
    votes,
  };
}

function inList(prefix: string, values: number[]) {
  return { sql: `${prefix} IN (${values.map(() => '?').join(',')})`, bind: values };
}

/** يبني جمل الحذف بالترتيب الآمن للمفاتيح: أصوات ← فائزون ← فائز يدوي ← مشاريع ← أقسام/مدارس. */
export function buildDeleteStatements(kind: DeleteKind, ids: number[], projectIds: number[]): Array<{ sql: string; bind: number[] }> {
  const statements: Array<{ sql: string; bind: number[] }> = [];
  const sectionIds = kind === 'sections' ? ids : [];

  if (projectIds.length) statements.push(inList('DELETE FROM votes WHERE project_id', projectIds));

  const winnerPrefix = projectIds.length
    ? (sectionIds.length ? 'DELETE FROM section_winners WHERE project_id' : 'DELETE FROM section_winners WHERE project_id')
    : (sectionIds.length ? 'DELETE FROM section_winners WHERE section_id' : '');
  if (projectIds.length && sectionIds.length) {
    statements.push({ sql: `${winnerPrefix} IN (${projectIds.map(() => '?').join(',')}) OR section_id IN (${sectionIds.map(() => '?').join(',')})`, bind: [...projectIds, ...sectionIds] });
  } else if (winnerPrefix) {
    statements.push(inList(winnerPrefix, projectIds.length ? projectIds : sectionIds));
  }

  if (projectIds.length) statements.push(inList('UPDATE result_settings SET manual_project_id = NULL WHERE manual_project_id', projectIds));

  if (kind === 'projects') {
    statements.push(inList('DELETE FROM projects WHERE id', ids));
  } else {
    if (projectIds.length) statements.push(inList(kind === 'sections' ? 'DELETE FROM projects WHERE section_id' : 'DELETE FROM projects WHERE school_id', ids));
    statements.push(inList(`DELETE FROM ${kind} WHERE id`, ids));
  }
  return statements;
}
