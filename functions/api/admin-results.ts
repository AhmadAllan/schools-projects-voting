export function calculateTie(rows: Array<{ votes: number }>) {
  if (!rows.length) return { tie: false, max: 0 };
  const max = Math.max(...rows.map((row) => row.votes));
  return { tie: max > 0 && rows.filter((row) => row.votes === max).length > 1, max };
}
export function csvWithBom(csv: string) { return '\ufeff' + csv; }
