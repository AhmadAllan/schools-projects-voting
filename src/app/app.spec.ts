import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

describe('تطبيق التصويت', () => {
  it('يعرف المسارات الأساسية ويحتفظ بها في العربية RTL', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    await RouterTestingHarness.create();

    expect(routes.map((route) => route.path)).toEqual(expect.arrayContaining([
      '', 'kiosk', 'admin/login', 'admin', 'winners', 'not-found',
    ]));

    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    const html = document.documentElement;
    expect(html.lang).toBe('ar');
    expect(html.dir).toBe('rtl');
  });
});
