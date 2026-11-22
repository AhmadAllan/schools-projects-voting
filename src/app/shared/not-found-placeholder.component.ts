import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <h1>الصفحة غير موجودة</h1>
      <a class="btn" routerLink="/">العودة إلى التصويت</a>
    </main>`,
})
export class NotFoundPlaceholderComponent {}
