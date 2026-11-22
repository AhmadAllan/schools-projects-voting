import { VoterStore } from './voter-store.service';
describe('حافظة الناخب', () => {
  it('يستبدل اختيار الفئة ويلغي الاختيار ويقيد ثلاث فئات', () => {
    const store = new VoterStore();
    store.toggleSelection(1, 10);
    expect(store.selections().length).toBe(1);
    store.toggleSelection(1, 11);
    expect(store.selections()).toEqual([{ sectionId: 1, projectId: 11 }]);
    store.toggleSelection(1, 11);
    expect(store.selections().length).toBe(0);
  });
  it('يعيد استخدام requestId نفسه ويخلق معرفًا جديدًا عند إعادة الضبط', () => {
    const store = new VoterStore();
    const first = store.requestId();
    expect(store.requestId()).toBe(first);
    store.reset();
    expect(store.requestId()).not.toBe(first);
  });
  it('يعيد خطوة التصويت إلى البداية عند إعادة الضبط', () => {
    const store = new VoterStore();
    store.step.set(3);
    store.reset();
    expect(store.step()).toBe(0);
  });
});
