export function publicResultsGate(value: string) {
  return value === '1'
    ? { allowed: true }
    : { allowed: false, code: 'RESULTS_NOT_PUBLISHED' };
}

export function withCacheHeaders(status = 200): Headers {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300',
  });
  return headers;
}

export async function getPublicBallot(db: D1Database) {
  const sections = await db.prepare('SELECT id,name,description,sort_order FROM sections WHERE is_active=1 ORDER BY sort_order ASC,id ASC').all();
  const projects = await db.prepare(`SELECT p.id,p.name,p.description,p.image_id,p.image_url,p.url,p.section_id,p.sort_order,
    s.name AS school_name, s.logo_image_id
    FROM projects p JOIN schools s ON s.id=p.school_id
    WHERE p.is_active=1 ORDER BY p.sort_order ASC,p.id ASC`).all();
  return { sections: sections.results, projects: projects.results };
}
