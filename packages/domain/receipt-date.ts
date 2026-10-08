// Explicit, unambiguous calendar dates only. No host locale, timezone or policy guess.
const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
export function receiptDate(raw: string): string | null {
  const iso = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(raw);
  let year: string, month: number, day: number;
  if (iso) {
    year = iso[1];
    month = +iso[2];
    day = +iso[3];
  } else {
    const named = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(raw);
    const american = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(raw);
    if (named || american) {
      const label = (named?.[2] ?? american![1]).toLowerCase();
      month =
        months.findIndex((m) => m === label || m.slice(0, 3) === label) + 1;
      day = +(named?.[1] ?? american![2]);
      year = named?.[3] ?? american![3];
      if (!month) return null;
    } else {
      const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
      if (!numeric) return null;
      const a = +numeric[1],
        b = +numeric[2];
      year = numeric[3];
      if (a > 12 && b <= 12) {
        day = a;
        month = b;
      } else if (b > 12 && a <= 12) {
        day = b;
        month = a;
      } else if (a === b) {
        day = a;
        month = b;
      } else return null;
    }
  }
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(+date) && date.toISOString().slice(0, 10) === value
    ? value
    : null;
}
