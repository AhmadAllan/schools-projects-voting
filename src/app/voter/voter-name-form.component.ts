import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NameParts } from '../core/models';

const ARABIC_NAME_PATTERN = /^[ء-ي ]{3,30}$/;
const NAME_ERROR = 'يجب أن يتكوّن الاسم من 3 أحرف عربية على الأقل';
const EMPTY_NAME: NameParts = { first: '', father: '', grandfather: '', family: '' };

type NameKey = keyof NameParts;

@Component({
  selector: 'app-voter-name-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>{{ heading() }}</h2>
    <form [formGroup]="form" (ngSubmit)="continueForm()">
      @for (field of fields; track field.key) {
        <label>
          {{ field.label }}
          <input [formControlName]="field.key" [id]="fieldId(field.key)" lang="ar" autocomplete="off" required
            [attr.aria-invalid]="showsError(field.key) ? 'true' : 'false'"
            [attr.aria-describedby]="showsError(field.key) ? fieldId(field.key) + '-error' : null">
          @if (showsError(field.key)) {
            <p class="field-error" [id]="fieldId(field.key) + '-error'">{{ NAME_ERROR }}</p>
          }
        </label>
      }
      <button type="submit" class="btn primary" [disabled]="form.invalid">متابعة</button>
    </form>
  `,
  styles: `
    form { display: grid; gap: .25rem; }
    label { display: grid; gap: .5rem; margin: 1rem 0; }
    input { min-height: 56px; padding: .75rem; }
    .field-error { margin: 0; color: var(--danger); font-size: .9rem; }
  `,
})
export class VoterNameFormComponent {
  readonly initial = input<NameParts>(EMPTY_NAME);
  readonly heading = input('أدخل اسمك الرباعي');
  readonly nameChange = output<NameParts>();
  readonly continueWith = output<NameParts>();

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly NAME_ERROR = NAME_ERROR;
  protected readonly fields: ReadonlyArray<{ key: NameKey; label: string }> = [
    { key: 'first', label: 'الاسم الأول' },
    { key: 'father', label: 'اسم الأب' },
    { key: 'grandfather', label: 'اسم الجد' },
    { key: 'family', label: 'اسم العائلة' },
  ];

  readonly form = this.fb.group({
    first: [EMPTY_NAME.first, [Validators.required, Validators.pattern(ARABIC_NAME_PATTERN)]],
    father: [EMPTY_NAME.father, [Validators.required, Validators.pattern(ARABIC_NAME_PATTERN)]],
    grandfather: [EMPTY_NAME.grandfather, [Validators.required, Validators.pattern(ARABIC_NAME_PATTERN)]],
    family: [EMPTY_NAME.family, [Validators.required, Validators.pattern(ARABIC_NAME_PATTERN)]],
  });

  constructor() {
    // Apply the host's stored name (e.g. VoterStore) when it differs from what the
    // user is typing — the field-wise guard breaks the initial→patch→emit cycle.
    effect(() => {
      const stored = this.initial();
      untracked(() => {
        const current = this.form.getRawValue();
        const differs = (Object.keys(stored) as NameKey[]).some((key) => stored[key] !== current[key]);
        if (differs) this.form.patchValue(stored);
      });
    });
    this.form.valueChanges.subscribe(() => this.nameChange.emit(this.form.getRawValue()));
  }

  protected fieldId(key: NameKey) { return `name-${key}`; }
  protected showsError(key: NameKey) {
    const control = this.form.controls[key];
    return control.invalid && control.touched;
  }
  protected continueForm() {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach((control) => control.markAsTouched());
      return;
    }
    this.continueWith.emit(this.form.getRawValue());
  }
}
