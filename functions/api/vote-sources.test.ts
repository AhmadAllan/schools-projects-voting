import { describe, expect, it } from 'vitest';
import {
  calculateProjectVotes,
  calculateSectionTies,
  calculateTies,
  groupResultsBySection,
} from './vote-sources';

describe('مصادر أصوات النتائج', () => {
  const project = { digitalVotes: 12, writtenVotes: 8 };

  it('يحسب الرقمي والورقي والمركب بشكل منفصل', () => {
    expect(calculateProjectVotes(project, 'digital')).toBe(12);
    expect(calculateProjectVotes(project, 'written')).toBe(8);
    expect(calculateProjectVotes(project, 'combined')).toBe(20);
  });

  it('يعيد جميع المتعادلين في المرتبة الأعلى ولا يختار فائزًا واحدًا', () => {
    expect(calculateTies([
      { projectId: 1, votes: 20 },
      { projectId: 2, votes: 20 },
      { projectId: 3, votes: 15 },
    ])).toEqual([1, 2]);
  });

  it('يحسب التعادل داخل كل قسم على حدة', () => {
    expect(calculateSectionTies([
      { sectionId: 1, projectId: 10, votes: 30 },
      { sectionId: 1, projectId: 11, votes: 30 },
      { sectionId: 1, projectId: 12, votes: 10 },
      { sectionId: 2, projectId: 20, votes: 50 },
      { sectionId: 2, projectId: 21, votes: 20 },
    ])).toEqual({ 1: [10, 11] });
  });

  it('لا يعتبر الصفر تعادلًا', () => {
    expect(calculateSectionTies([
      { sectionId: 1, projectId: 10, votes: 0 },
      { sectionId: 1, projectId: 11, votes: 0 },
    ])).toEqual({});
  });

  it('يجمع النتائج حسب القسم ويرتبها ويستبعد غير المعلن', () => {
    const sections = groupResultsBySection([
      { sectionId: 2, sectionName: 'الثاني', projectId: 20, projectName: 'ب', votes: 5 },
      { sectionId: 1, sectionName: 'الأول', projectId: 10, projectName: 'أ', votes: 7 },
      { sectionId: 1, sectionName: 'الأول', projectId: 11, projectName: 'ج', votes: 9 },
      { sectionId: 1, sectionName: 'الأول', projectId: 12, projectName: 'د', votes: 9, announceInResults: 0 },
    ]);

    expect(sections).toEqual([
      {
        section_id: 2,
        section_name: 'الثاني',
        projects: [{ project_id: 20, project_name: 'ب', votes: 5 }],
        tiedProjects: [],
      },
      {
        section_id: 1,
        section_name: 'الأول',
        projects: [
          { project_id: 11, project_name: 'ج', votes: 9 },
          { project_id: 10, project_name: 'أ', votes: 7 },
        ],
        tiedProjects: [],
      },
    ]);
  });
});
