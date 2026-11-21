export function normalizeArabic(input: string): string {
  return input.normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateArabicNamePart(input: string): { valid: boolean; value: string; letters: number } {
  const value = normalizeArabic(input).replace(/ـ/g, ' ').replace(/\s+/g, ' ').trim();
  const letters = value.replace(/\s/g, '').length;
  const valid = letters >= 3 && letters <= 30 && /^[ء-ي ]+$/.test(value) && !/^ | $/.test(value);
  return { valid, value, letters };
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
