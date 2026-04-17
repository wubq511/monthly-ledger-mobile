function pad(value: number) {
  return String(value).padStart(2, '0');
}

function isValidDateParts(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const candidate = new Date(year, month - 1, day);

  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
}

function formatLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function getCurrentDateKey() {
  return formatLocalDateKey(new Date());
}

export function getPreviousMonthKey() {
  return shiftMonth(getCurrentMonthKey(), -1);
}

export function getPreviousDateKey() {
  return shiftDate(getCurrentDateKey(), -1);
}

export function shiftMonth(monthKey: string, delta: number) {
  const [yearString, monthString] = monthKey.split('-');
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;
  const next = new Date(year, monthIndex + delta, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
}

export function shiftDate(dateKey: string, delta: number) {
  const [yearString, monthString, dayString] = dateKey.split('-');
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;
  const day = Number(dayString);
  const next = new Date(year, monthIndex, day + delta);

  return formatLocalDateKey(next);
}

export function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-');
  return `${year}年${Number(month)}月`;
}

export function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function formatShortMonthLabel(monthKey: string) {
  const [, month] = monthKey.split('-');
  return `${Number(month)}月`;
}

export function getMonthKeyFromDateKey(dateKey: string) {
  return dateKey.slice(0, 7);
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

export function isValidDateInput(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false;
  }

  const [yearString, monthString, dayString] = dateKey.split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  return isValidDateParts(year, month, day);
}
