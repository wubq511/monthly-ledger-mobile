function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function getPreviousMonthKey() {
  return shiftMonth(getCurrentMonthKey(), -1);
}

export function shiftMonth(monthKey: string, delta: number) {
  const [yearString, monthString] = monthKey.split('-');
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;
  const next = new Date(year, monthIndex + delta, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
}

export function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-');
  return `${year}年${Number(month)}月`;
}

export function formatShortMonthLabel(monthKey: string) {
  const [, month] = monthKey.split('-');
  return `${Number(month)}月`;
}

export function isValidMonthInput(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return false;
  }

  const [yearString, monthString] = monthKey.split('-');
  const year = Number(yearString);
  const month = Number(monthString);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return false;
  }

  return month >= 1 && month <= 12;
}
