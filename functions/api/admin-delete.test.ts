import { describe, expect, it } from 'vitest';
import { buildDeleteStatements, cascadePreview, DeleteData, parseDeleteIds } from './admin-delete';

const DATA: DeleteData = {
  sections: [
    { id: 1, name: 'الروبوتات' },
    { id: 2, name: 'الطاقة' },
    { id: 3, name: 'الزراعة' },
  ],
  schools: [
    { id: 10, name: 'مدرسة النور' },
    { id: 11, name: 'مدرسة السلام' },
  ],
  projects: [
    { id: 101, name: 'مشروع القمر', section_id: 1, school_id: 10, section_name: 'الروبوتات', school_name: 'مدرسة النور', written_votes: 5 },
    { id: 102, name: 'مشروع الشمس', section_id: 1, school_id: 11, section_name: 'الروبوتات', school_name: 'مدرسة السلام', written_votes: 0 },
    { id: 103, name: 'مشروع الرياح', section_id: 2, school_id: 10, section_name: 'الطاقة', school_name: 'مدرسة النور', written_votes: 2 },
    { id: 104, name: 'مشروع القمح', section_id: 3, school_id: 11, section_name: 'الزراعة', school_name: 'مدرسة السلام', written_votes: 50 },
  ],
  votes: [
    { project_id: 101, n: 3 },
    { project_id: 102, n: 1 },
    { project_id: 103, n: 1 },
  ],
};

describe('الحذف المتسلسل', () => {
  it('parseDeleteIds يقبل الأرقام والنصوص الرقمية ويحذف التكرار', () => {
    expect(parseDeleteIds({ ids: [1, '2', 2] })).toEqual({ valid: true, ids: [1, 2] });
  });

  it('parseDeleteIds يرفض المدخلات الفارغة أو غير الصالحة أو الطويلة', () => {
    expect(parseDeleteIds({ ids: [] }).valid).toBe(false);
    expect(parseDeleteIds({ ids: 'x' }).valid).toBe(false);
    expect(parseDeleteIds({ ids: [0] }).valid).toBe(false);
    expect(parseDeleteIds({ ids: [1, null] }).valid).toBe(false);
    expect(parseDeleteIds(null).valid).toBe(false);
    expect(parseDeleteIds({ ids: Array.from({ length: 201 }, (_, i) => i + 1) }).valid).toBe(false);
  });

  it('معاينة حذف قسم تحسب مشاريعه وأصواتها الإلكترونية والورقية مع السياق', () => {
    const preview = cascadePreview('sections', [1], DATA);
    expect(preview.items).toEqual([{ id: 1, name: 'الروبوتات' }]);
    expect(preview.projects.map((project) => project.id)).toEqual([101, 102]);
    expect(preview.projects[0]!.context).toContain('مدرسة النور');
    expect(preview.projects[0]!.context).toContain('الروبوتات');
    expect(preview.votes).toBe(3 + 1 + 5 + 0);
  });

  it('معاينة حذف مدرسة تسقط مشاريعها وأصواتها فقط', () => {
    const preview = cascadePreview('schools', [10], DATA);
    expect(preview.items).toEqual([{ id: 10, name: 'مدرسة النور' }]);
    expect(preview.projects.map((project) => project.id)).toEqual([101, 103]);
    expect(preview.votes).toBe(3 + 5 + 1 + 2);
  });

  it('معاينة حذف مشاريع مباشرة تجمع الأصوات الورقية أيضًا', () => {
    const preview = cascadePreview('projects', [101, 104], DATA);
    expect(preview.items.map((item) => item.id)).toEqual([101, 104]);
    expect(preview.projects.map((project) => project.id)).toEqual([101, 104]);
    expect(preview.votes).toBe(3 + 5 + 50);
  });

  it('ترتيب الجمل يحترم المفاتيح: أصوات ثم فائزون ثم يدوي ثم مشاريع ثم الأقسام', () => {
    const statements = buildDeleteStatements('sections', [1], [101, 102]);
    expect(statements[0]!.sql).toContain('DELETE FROM votes');
    expect(JSON.parse(statements[0]!.bind[0]!.toString())).toEqual([101, 102]);
    expect(statements[1]!.sql).toContain('DELETE FROM section_winners');
    expect(statements[1]!.sql).toContain('project_id');
    expect(statements[1]!.sql).toContain('section_id');
    expect(JSON.parse(statements[1]!.bind[0]!.toString())).toEqual([101, 102]);
    expect(JSON.parse(statements[1]!.bind[1]!.toString())).toEqual([1]);
    expect(statements[2]!.sql).toContain('UPDATE result_settings');
    expect(statements[3]!.sql).toContain('DELETE FROM projects');
    expect(JSON.parse(statements[3]!.bind[0]!.toString())).toEqual([1]);
    expect(statements[4]!.sql).toContain('DELETE FROM sections');
    expect(JSON.parse(statements[4]!.bind[0]!.toString())).toEqual([1]);
  });

  it('قسم بلا مشاريع لا يولد جمل أصوات أو مشاريع', () => {
    const statements = buildDeleteStatements('sections', [3], []);
    expect(statements.some((statement) => statement.sql.includes('votes'))).toBe(false);
    expect(statements.some((statement) => statement.sql.includes('DELETE FROM projects'))).toBe(false);
    expect(statements.at(-1)!.sql).toContain('DELETE FROM sections');
  });

  it('حذف مشروع يمسح فائزه اليدوي دون بقية الفائزين', () => {
    const statements = buildDeleteStatements('projects', [101], [101]);
    expect(statements.find((statement) => statement.sql.includes('section_winners'))!.sql).not.toContain('section_id IN');
    expect(JSON.parse(statements.find((statement) => statement.sql.includes('section_winners'))!.bind[0]!.toString())).toEqual([101]);
    expect(JSON.parse(statements.find((statement) => statement.sql.includes('DELETE FROM projects'))!.bind[0]!.toString())).toEqual([101]);
  });

  it('حذف مدرسة ينظف الفائزين عبر المشاريع الساقطة', () => {
    const statements = buildDeleteStatements('schools', [10], [101, 103]);
    expect(JSON.parse(statements.find((statement) => statement.sql.includes('section_winners'))!.bind[0]!.toString())).toEqual([101, 103]);
    expect(JSON.parse(statements.find((statement) => statement.sql.includes('DELETE FROM projects'))!.bind[0]!.toString())).toEqual([10]);
    expect(JSON.parse(statements.find((statement) => statement.sql.includes('DELETE FROM schools'))!.bind[0]!.toString())).toEqual([10]);
  });

  it('قوائم كبيرة تبقى بربط واحد لكل عبارة (حد D1 مئة معامل)', () => {
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);
    const projectIds = Array.from({ length: 150 }, (_, i) => i + 1000);
    const statements = buildDeleteStatements('sections', ids, projectIds);
    expect(statements.length).toBe(5);
    for (const statement of statements) {
      expect(statement.bind.length).toBeLessThanOrEqual(2);
      expect(statement.sql.match(/\?/g)?.length).toBe(statement.bind.length);
      for (const bound of statement.bind) expect(JSON.parse(bound.toString()).length).toBe(150);
    }
    expect(JSON.parse(statements[0]!.bind[0]!.toString()).length).toBe(150);
    expect(JSON.parse(statements[4]!.bind[0]!.toString()).length).toBe(150);
  });
});
