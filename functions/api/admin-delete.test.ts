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
    { id: 101, name: 'مشروع القمر', section_id: 1, school_id: 10, section_name: 'الروبوتات', school_name: 'مدرسة النور' },
    { id: 102, name: 'مشروع الشمس', section_id: 1, school_id: 11, section_name: 'الروبوتات', school_name: 'مدرسة السلام' },
    { id: 103, name: 'مشروع الرياح', section_id: 2, school_id: 10, section_name: 'الطاقة', school_name: 'مدرسة النور' },
    { id: 104, name: 'مشروع القمح', section_id: 3, school_id: 11, section_name: 'الزراعة', school_name: 'مدرسة السلام' },
  ],
  votes: [
    { project_id: 101 }, { project_id: 101 }, { project_id: 101 },
    { project_id: 102 }, { project_id: 103 },
  ],
  winners: [
    { section_id: 1, project_id: 101 },
    { section_id: 2, project_id: 103 },
  ],
  manualProjectId: 102,
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

  it('معاينة حذف قسم تحسب مشاريعه وأصواتها مع سياق المدرسة والقسم', () => {
    const preview = cascadePreview('sections', [1], DATA);
    expect(preview.items).toEqual([{ id: 1, name: 'الروبوتات' }]);
    expect(preview.projects.map((project) => project.id)).toEqual([101, 102]);
    expect(preview.projects[0]!.context).toContain('مدرسة النور');
    expect(preview.projects[0]!.context).toContain('الروبوتات');
    expect(preview.votes).toBe(4);
  });

  it('معاينة حذف مدرسة تسقط مشاريعها وأصواتها فقط', () => {
    const preview = cascadePreview('schools', [10], DATA);
    expect(preview.items).toEqual([{ id: 10, name: 'مدرسة النور' }]);
    expect(preview.projects.map((project) => project.id)).toEqual([101, 103]);
    expect(preview.votes).toBe(4);
  });

  it('معاينة حذف مشاريع مباشرة تحسب أصواتها', () => {
    const preview = cascadePreview('projects', [101, 104], DATA);
    expect(preview.items.map((item) => item.id)).toEqual([101, 104]);
    expect(preview.projects.map((project) => project.id)).toEqual([101, 104]);
    expect(preview.votes).toBe(3);
  });

  it('ترتيب الجمل يحترم المفاتيح: أصوات ثم فائزون ثم يدوي ثم مشاريع ثم الأقسام', () => {
    const statements = buildDeleteStatements('sections', [1], [101, 102]);
    expect(statements[0]!.sql).toContain('DELETE FROM votes');
    expect(statements[0]!.bind).toEqual([101, 102]);
    expect(statements[1]!.sql).toContain('DELETE FROM section_winners');
    expect(statements[1]!.bind).toEqual([101, 102, 1]);
    expect(statements[2]!.sql).toContain('UPDATE result_settings');
    expect(statements[3]!.sql).toContain('DELETE FROM projects');
    expect(statements[3]!.bind).toEqual([1]);
    expect(statements[4]!.sql).toContain('DELETE FROM sections');
    expect(statements[4]!.bind).toEqual([1]);
  });

  it('قسم بلا مشاريع لا يولد جمل أصوات أو مشاريع', () => {
    const statements = buildDeleteStatements('sections', [3], []);
    expect(statements.some((statement) => statement.sql.includes('votes'))).toBe(false);
    expect(statements.some((statement) => statement.sql.includes('DELETE FROM projects'))).toBe(false);
    expect(statements.at(-1)!.sql).toContain('DELETE FROM sections');
  });

  it('حذف مشروع يمسح فائزه اليدوي دون بقية الفائزين', () => {
    const statements = buildDeleteStatements('projects', [101], [101]);
    expect(statements.find((statement) => statement.sql.includes('section_winners'))!.bind).toEqual([101]);
    expect(statements.find((statement) => statement.sql.includes('DELETE FROM projects'))!.bind).toEqual([101]);
  });

  it('حذف مدرسة ينظف الفائزين عبر المشاريع الساقطة', () => {
    const statements = buildDeleteStatements('schools', [10], [101, 103]);
    expect(statements.find((statement) => statement.sql.includes('section_winners'))!.bind).toEqual([101, 103]);
    expect(statements.find((statement) => statement.sql.includes('DELETE FROM projects'))!.bind).toEqual([10]);
    expect(statements.find((statement) => statement.sql.includes('DELETE FROM schools'))!.bind).toEqual([10]);
  });
});
