import { fromDate, parseDateTime, toCalendarDateTime, type CalendarDateTime } from '@internationalized/date';

export const DISPLAY_TIME_ZONE = 'Asia/Karachi';

const OFFSET = /(Z|[+-]\d{2}:\d{2})$/;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?)(Z|[+-]\d{2}:\d{2})?$/;

export function parseServerDateTime(value: string | null | undefined): Date | null {
  if (typeof value !== 'string') return null;
  const parts = value.match(TIMESTAMP);
  if (!parts) return null;
  try {
    if (parseDateTime(parts[1]).day < 1) return null;
    // Server LocalDateTime is UTC; an explicit offset already identifies the instant.
    const date = new Date(parts[2] ? value : `${value}Z`);
    return Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function formatDateTime(value: string | null | undefined): string {
  const date = parseServerDateTime(value);
  return date ? `${formatter.format(date)} (${DISPLAY_TIME_ZONE})` : 'Date unavailable';
}

export function toPickerDateTime(value: string | null | undefined): CalendarDateTime | null {
  const date = parseServerDateTime(value);
  return date ? toCalendarDateTime(fromDate(date, DISPLAY_TIME_ZONE)) : null;
}

export function fromPickerDateTime(value: CalendarDateTime | null): string {
  if (!value) return '';
  try {
    return value.toDate(DISPLAY_TIME_ZONE, 'reject').toISOString().replace(/(?:\.000)?Z$/, '');
  } catch {
    return '';
  }
}

export function toApiDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = parseServerDateTime(value);
  if (!date) return '';
  if (!OFFSET.test(value)) return value;
  // Date truncates Java's sub-millisecond precision, so keep the original fraction.
  return date.toISOString().slice(0, 19) + (value.match(/\.\d+/)?.[0] ?? '');
}
