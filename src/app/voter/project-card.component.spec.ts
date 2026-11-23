import { TestBed } from '@angular/core/testing';
import { ProjectCardComponent } from './project-card.component';
import { BallotProject } from '../core/models';

const PROJECT: BallotProject = {
  id: 11,
  name: 'مشروع القمر',
  description: 'وصف المشروع الطويل',
  section_id: 1,
  school_name: 'مدرسة النور',
};

const IMAGED: BallotProject = { ...PROJECT, id: 12, image_url: 'https://example.com/p.png' };

describe('بطاقة المشروع', () => {
  async function render(overrides: { project?: BallotProject; sectionName?: string; badgeIndex?: number; selected?: boolean; locked?: boolean } = {}) {
    const fixture = TestBed.createComponent(ProjectCardComponent);
    fixture.componentRef.setInput('project', overrides.project ?? PROJECT);
    fixture.componentRef.setInput('sectionName', overrides.sectionName ?? 'الروبوتات');
    if (overrides.badgeIndex !== undefined) fixture.componentRef.setInput('badgeIndex', overrides.badgeIndex);
    fixture.componentRef.setInput('selected', overrides.selected ?? false);
    fixture.componentRef.setInput('locked', overrides.locked ?? false);
    await fixture.whenStable();
    return fixture;
  }

  function voteButton(el: HTMLElement) {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.classList.contains('vote-btn'))!;
  }

  it('يعرض صورة عند توفر رابط ونائباً بالحرف الأول عند غيابها', async () => {
    const withImage = (await render({ project: IMAGED })).nativeElement as HTMLElement;
    expect(withImage.querySelector('img')?.getAttribute('src')).toBe('https://example.com/p.png');
    const plain = (await render()).nativeElement as HTMLElement;
    expect(plain.querySelector('img')).toBeNull();
    expect(plain.querySelector('.placeholder')?.textContent?.trim()).toBe('م');
  });

  it('يعرض شارة الفئة مع لون حسب ترتيبها', async () => {
    const el = (await render({ sectionName: 'الروبوتات', badgeIndex: 4 })).nativeElement as HTMLElement;
    const badge = el.querySelector('.badge')!;
    expect(badge.textContent?.trim()).toBe('الروبوتات');
    expect(badge.classList.contains('badge-1')).toBe(true);
  });

  it('يعرض اسماً ووصفاً وسطر المدرسة', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    expect(el.textContent).toContain('مشروع القمر');
    expect(el.querySelector('.desc')?.textContent).toContain('وصف المشروع الطويل');
    expect(el.textContent).toContain('مدرسة النور');
  });

  it('زر التصويت يتبع حالة الاختيار نصاً و aria-pressed', async () => {
    const plain = (await render()).nativeElement as HTMLElement;
    expect(voteButton(plain).textContent?.trim()).toBe('تصويت');
    expect(voteButton(plain).getAttribute('aria-pressed')).toBe('false');
    const chosen = (await render({ selected: true })).nativeElement as HTMLElement;
    expect(voteButton(chosen).textContent?.trim()).toBe('مُختار');
    expect(voteButton(chosen).getAttribute('aria-pressed')).toBe('true');
  });

  it('يعطّل زر التصويت عند بلوغ الحد وعدم الاختيار، ويبقيه متاحاً للمختار', async () => {
    const locked = (await render({ locked: true })).nativeElement as HTMLElement;
    expect(voteButton(locked).disabled).toBe(true);
    const lockedSelected = (await render({ locked: true, selected: true })).nativeElement as HTMLElement;
    expect(voteButton(lockedSelected).disabled).toBe(false);
  });

  it('النقر يرسل تبديل الاختيار وفتح التفاصيل', async () => {
    const fixture = await render();
    const toggles: void[] = [];
    const details: void[] = [];
    fixture.componentInstance.toggle.subscribe(() => toggles.push(undefined));
    fixture.componentInstance.details.subscribe(() => details.push(undefined));
    const el = fixture.nativeElement as HTMLElement;
    voteButton(el).click();
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'التفاصيل')!.click();
    expect(toggles.length).toBe(1);
    expect(details.length).toBe(1);
  });
});
