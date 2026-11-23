import { Injectable, signal } from '@angular/core';
import { NameParts, Selection } from '../core/models';
@Injectable({ providedIn: 'root' })
export class VoterStore {
  readonly name = signal<NameParts>({ first: '', father: '', grandfather: '', family: '' });
  readonly selections = signal<Selection[]>([]);
  readonly requestId = signal(crypto.randomUUID());
  readonly submitting = signal(false);
  readonly duplicateWarning = signal(false);
  readonly step = signal(0);
  toggleSelection(sectionId: number, projectId: number) {
    const current = this.selections();
    const existing = current.find((selection) => selection.projectId === projectId);
    if (existing) this.selections.set(current.filter((selection) => selection.projectId !== projectId));
    else if (current.length < 3) this.selections.set([...current, { sectionId, projectId }]);
  }
  reset() {
    this.step.set(0);
    this.name.set({ first: '', father: '', grandfather: '', family: '' });
    this.selections.set([]); this.requestId.set(crypto.randomUUID()); this.submitting.set(false); this.duplicateWarning.set(false);
  }
}
