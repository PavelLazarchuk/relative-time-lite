import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { selectUnit } from '../src/selectUnit';

// New York springs forward 2024-03-10 07:00Z and falls back 2024-11-03 06:00Z.
const ORIGINAL_TZ = process.env.TZ;

const at = (iso: string) => new Date(iso).getTime();
const HOUR = 3_600_000;

describe('daylight saving transitions (America/New_York)', () => {
    beforeAll(() => {
        process.env.TZ = 'America/New_York';
    });

    afterAll(() => {
        process.env.TZ = ORIGINAL_TZ;
    });

    it('measures sub-day units as elapsed time, not wall clock', () => {
        // 12:00 local Saturday to 12:00 local Sunday is 23 real hours because
        // one hour was skipped, and that is what gets reported.
        const before = at('2024-03-09T17:00:00Z'); // 12:00 EST
        const after = at('2024-03-10T16:00:00Z'); // 12:00 EDT

        expect(selectUnit(before, after)).toEqual({ value: 23, unit: 'hour' });
        expect(selectUnit(before, before + 24 * HOUR)).toEqual({ value: 1, unit: 'day' });
    });

    it('keeps calendar months exact across a spring-forward', () => {
        expect(selectUnit(at('2024-03-01T05:00:00Z'), at('2024-04-01T04:00:00Z'))).toEqual({
            value: 1,
            unit: 'month',
        });
    });

    it('keeps calendar months exact across a fall-back', () => {
        expect(selectUnit(at('2024-10-01T04:00:00Z'), at('2024-11-01T04:00:00Z'))).toEqual({
            value: 1,
            unit: 'month',
        });
    });

    it('keeps a year a year across two transitions', () => {
        expect(selectUnit(at('2023-06-15T16:00:00Z'), at('2024-06-15T16:00:00Z'))).toEqual({
            value: 1,
            unit: 'year',
        });
    });

    it('does not let a short month plus a lost hour degrade into weeks', () => {
        // Feb 28 to Mar 28 is 28 days and 23 hours of elapsed time. An average
        // 30.44-day month would call that "4 weeks"; the calendar says one month.
        expect(selectUnit(at('2024-02-28T05:00:00Z'), at('2024-03-28T04:00:00Z'))).toEqual({
            value: 1,
            unit: 'month',
        });
    });
});

describe('a half-hour offset with a half-hour shift (Australia/Lord_Howe)', () => {
    beforeAll(() => {
        process.env.TZ = 'Australia/Lord_Howe';
    });

    afterAll(() => {
        process.env.TZ = ORIGINAL_TZ;
    });

    it('measures calendar months on local dates, not UTC ones', () => {
        expect(selectUnit(at('2024-03-01T00:00:00Z'), at('2024-04-01T00:00:00Z'))).toEqual({
            value: 1,
            unit: 'month',
        });
    });

    it('keeps a year a year across the 30-minute transitions', () => {
        expect(selectUnit(at('2023-06-15T02:00:00Z'), at('2024-06-15T02:00:00Z'))).toEqual({
            value: 1,
            unit: 'year',
        });
    });

    it('reads the days either side of a shift as elapsed time', () => {
        const before = at('2024-04-06T13:00:00Z');

        expect(selectUnit(before, before + 24 * HOUR)).toEqual({ value: 1, unit: 'day' });
    });
});
