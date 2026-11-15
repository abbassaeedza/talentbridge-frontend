import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDateTime } from '@internationalized/date';
import { formatDateTime, fromPickerDateTime, parseServerDateTime, toApiDateTime, toPickerDateTime } from './dateTime.ts';

test('naive backend LocalDateTime represents UTC, including Java fractional precision', () => {
  for (const [value, expected] of [
    ['2031-01-02T00:00', '2031-01-02T00:00:00.000Z'],
    ['2031-01-02T00:00:00', '2031-01-02T00:00:00.000Z'],
    ['2031-01-02T00:00:45.123456789', '2031-01-02T00:00:45.123Z'],
  ]) assert.equal(parseServerDateTime(value)?.toISOString(), expected);
});

test('explicit positive, negative, and zero-hour offsets preserve their instants', () => {
  for (const value of ['2031-01-02T00:00:00Z', '2031-01-02T05:00:00+05:00', '2031-01-01T16:00:00-08:00', '2031-01-01T23:30:00-00:30']) {
    assert.equal(parseServerDateTime(value)?.toISOString(), '2031-01-02T00:00:00.000Z');
  }
});

test('missing and invalid timestamps never normalize into a different valid date', () => {
  for (const value of [null, undefined, '', 'invalid', '2031-01-02', '2031-02-29T12:00:00', '2031-04-31T12:00', '2031-01-00T12:00', '2031-13-01T12:00', '2031-01-01T24:00', '2031-01-01T12:60', '2031-01-01T12:00:60', '2031-01-01T12:00+25:00', '2031-01-01T12:00:00Zjunk']) {
    assert.equal(parseServerDateTime(value), null, String(value));
    assert.equal(toPickerDateTime(value), null, String(value));
    assert.equal(formatDateTime(value), 'Date unavailable', String(value));
    assert.equal(toApiDateTime(value), '', String(value));
  }
  assert.equal(parseServerDateTime('2032-02-29T12:00')?.toISOString(), '2032-02-29T12:00:00.000Z');
});

test('all browser timezones display the same explicitly labeled Karachi wall time', () => {
  const initialTZ = process.env.TZ;
  try {
    for (const timeZone of ['UTC', 'America/Los_Angeles', 'Asia/Karachi', 'Pacific/Auckland']) {
      process.env.TZ = timeZone;
      assert.equal(formatDateTime('2031-01-01T23:30:00'), '02 Jan 2031, 04:30 (Asia/Karachi)');
      assert.equal(formatDateTime('2031-01-02T04:30:00+05:00'), '02 Jan 2031, 04:30 (Asia/Karachi)');
      assert.equal(toPickerDateTime('2031-01-01T23:30:00')?.toString(), '2031-01-02T04:30:00');
      assert.equal(fromPickerDateTime(parseDateTime('2031-01-02T01:30')), '2031-01-01T20:30:00');
    }
  } finally {
    if (initialTZ === undefined) delete process.env.TZ;
    else process.env.TZ = initialTZ;
  }
});

test('Karachi picker conversion crosses month, year, and leap-day boundaries in UTC', () => {
  for (const [wallTime, utc] of [
    ['2031-01-01T01:30', '2030-12-31T20:30:00'],
    ['2031-03-01T00:00', '2031-02-28T19:00:00'],
    ['2032-03-01T00:00', '2032-02-29T19:00:00'],
    ['2031-07-01T23:59', '2031-07-01T18:59:00'],
  ]) {
    assert.equal(fromPickerDateTime(parseDateTime(wallTime)), utc);
    assert.equal(toPickerDateTime(utc)?.toString(), parseDateTime(wallTime).toString());
  }
  assert.equal(fromPickerDateTime(null), '');
});

test('LocalDateTime request serialization preserves naive precision and converts offsets, never appending Z', () => {
  const stored = '2031-01-02T00:00:45.123456789';
  assert.equal(toApiDateTime(stored), stored);
  assert.equal(toApiDateTime('2031-01-02T05:00:45.123+05:00'), '2031-01-02T00:00:45.123');
  assert.equal(toApiDateTime('2031-01-02T05:00:45.123456789+05:00'), '2031-01-02T00:00:45.123456789');
  assert.equal(toApiDateTime('2031-01-02T00:00:00Z'), '2031-01-02T00:00:00');
  assert.equal(toApiDateTime('2031-01-02T00:00'), '2031-01-02T00:00');
});

test('naive deadline has the same before, exact, and after boundary as UTC server enforcement', () => {
  const deadline = parseServerDateTime('2031-01-02T00:00:00')!.getTime();
  assert.equal(deadline - Date.parse('2031-01-01T23:59:59.999Z'), 1);
  assert.equal(deadline - Date.parse('2031-01-02T00:00:00Z'), 0);
  assert.equal(deadline - Date.parse('2031-01-02T00:00:00.001Z'), -1);
});
