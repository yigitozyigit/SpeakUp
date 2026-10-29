export function validTimezone(value) {
  if (typeof value !== 'string' || value.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date()); return true; }
  catch { return false; }
}

export function localDateKey(date = new Date(), timezone = 'Europe/Istanbul') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = {};
  parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
  return values.year + '-' + values.month + '-' + values.day;
}

export function addCalendarDays(dateKey, amount) {
  const parts = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + amount));
  return date.toISOString().slice(0, 10);
}

export function calendarDayDifference(earlier, later) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(earlier || '') || !/^\d{4}-\d{2}-\d{2}$/.test(later || '')) return null;
  const a = Date.parse(earlier + 'T00:00:00Z');
  const b = Date.parse(later + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

export function utcMinuteKey(date = new Date()) {
  return date.toISOString().slice(0, 16).replace(/[-:T]/g, '');
}
