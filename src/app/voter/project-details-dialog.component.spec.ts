import { TestBed } from '@angular/core/testing';
import { ProjectDetailsDialogComponent } from './project-details-dialog.component';
import { BallotProject } from '../core/models';

const PROJECT: BallotProject = {
  id: 11,
  name: 'مشروع القمر',
  description: 'وصف طويل كامل للمشروع يظهر في نافذة التفاصيل',
  section_id: 1,
  school_name: 'مدرسة النور',
};

describe('نافذة تفاصيل المشروع', () => {
  async function render(overrides: { project?: BallotProject | null; selected?: boolean; locked?: boolean } = {}) {
    const fixture = TestBed.createComponent(ProjectDetailsDialogComponent);
    fixture.componentRef.setInput('project', overrides.project ?? null);
    fixture.componentRef.setInput('sectionName', 'الروبوتات');
    fixture.componentRef.setInput('selected', overrides.selected ?? false);
    fixture.componentRef.setInput('locked', overrides.locked ?? false);
    await fixture.whenStable();
    return fixture;
  }

  function dialog(el: HTMLElement) { return el.querySelector('dialog')!; }

  it('تبقى مغلقة دون مشروع وتفتح عند تعيينه', async () => {
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    expect(dialog(el).open).toBe(false);
    fixture.componentRef.setInput('project', PROJECT);
    await fixture.whenStable();
    expect(dialog(el).open).toBe(true);
    expect(el.textContent).toContain('مشروع القمر');
    expect(el.textContent).toContain('وصف طويل كامل للمشروع يظهر في نافذة التفاصيل');
    expect(el.textContent).toContain('مدرسة النور');
    expect(el.textContent).toContain('الروبوتات');
  });

  it('تغلق عند إعادة المشروع إلى null دون إرسال تبديل', async () => {
    const fixture = await render({ project: PROJECT });
    const toggles: void[] = [];
    fixture.componentInstance.toggle.subscribe(() => toggles.push(undefined));
    fixture.componentRef.setInput('project', null);
    await fixture.whenStable();
    expect(dialog(fixture.nativeElement as HTMLElement).open).toBe(false);
    expect(toggles.length).toBe(0);
  });

  it('رابط زيارة المشروع يظهر فقط عند توفر رابط', async () => {
    const without = (await render({ project: PROJECT })).nativeElement as HTMLElement;
    expect(without.querySelector('a.visit')).toBeNull();
    const withUrl = (await render({ project: { ...PROJECT, url: 'https://example.com' } })).nativeElement as HTMLElement;
    const visit = withUrl.querySelector<HTMLAnchorElement>('a.visit')!;
    expect(visit).toBeTruthy();
    expect(visit.getAttribute('href')).toBe('https://example.com');
    expect(visit.getAttribute('target')).toBe('_blank');
    expect(visit.getAttribute('rel')).toBe('noopener');
  });

  it('زر التصويت يرسل تبديلاً ويعكس الحالة والعطب', async () => {
    const fixture = await render({ project: PROJECT });
    const toggles: void[] = [];
    fixture.componentInstance.toggle.subscribe(() => toggles.push(undefined));
    const el = fixture.nativeElement as HTMLElement;
    const vote = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.classList.contains('vote-btn'))!;
    expect(vote.textContent?.trim()).toBe('تصويت');
    vote.click();
    expect(toggles.length).toBe(1);

    const locked = (await render({ project: PROJECT, locked: true })).nativeElement as HTMLElement;
    const lockedVote = Array.from(locked.querySelectorAll('button')).find((b) => b.classList.contains('vote-btn'))!;
    expect(lockedVote.disabled).toBe(true);

    const chosen = (await render({ project: PROJECT, selected: true })).nativeElement as HTMLElement;
    const chosenVote = Array.from(chosen.querySelectorAll('button')).find((b) => b.classList.contains('vote-btn'))!;
    expect(chosenVote.textContent?.trim()).toBe('مُختار');
  });

  it('زر الإغلاق وحدث cancel يرسلان closed', async () => {
    const fixture = await render({ project: PROJECT });
    const closed: void[] = [];
    fixture.componentInstance.closed.subscribe(() => closed.push(undefined));
    const el = fixture.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'إغلاق')!.click();
    expect(closed.length).toBe(1);
    dialog(el).dispatchEvent(new Event('cancel'));
    expect(closed.length).toBe(2);
  });
});
