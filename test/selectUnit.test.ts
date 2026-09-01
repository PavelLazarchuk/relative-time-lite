import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { selectUnit } from '../src/selectUnit';
import type { SelectUnitOptions } from '../src/types';

const ORIGINAL_TZ = process.env.TZ;

const pinUtc = () => {
    beforeAll(() => {
        process.env.TZ = 'UTC';
    });

    afterAll(() => {
        process.env.TZ = ORIGINAL_TZ;
    });
};

const at = (iso: string) => new Date(iso).getTime();
const NOW = at('2024-03-15T12:00:00.000Z');

const from = (offsetMs: number, options?: SelectUnitOptions) =>
    selectUnit(NOW, NOW + offsetMs, options);

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('selectUnit', () => {
    it('reports the present as zero seconds', () => {
        expect(from(0)).toEqual({ value: 0, unit: 'second' });
    });

    describe('rounding boundaries', () => {
        it.each([
            [0, { value: 0, unit: 'second' }],
            [SECOND, { value: 1, unit: 'second' }],
            [59 * SECOND, { value: 59, unit: 'second' }],
            [59.4 * SECOND, { value: 59, unit: 'second' }],
            [59.5 * SECOND, { value: 1, unit: 'minute' }],
            [60 * SECOND, { value: 1, unit: 'minute' }],
            [89 * SECOND, { value: 1, unit: 'minute' }],
            [90 * SECOND, { value: 2, unit: 'minute' }],
            [59 * MINUTE, { value: 59, unit: 'minute' }],
            [59.5 * MINUTE, { value: 1, unit: 'hour' }],
            [60 * MINUTE, { value: 1, unit: 'hour' }],
            [23 * HOUR, { value: 23, unit: 'hour' }],
            [23.5 * HOUR, { value: 1, unit: 'day' }],
            [24 * HOUR, { value: 1, unit: 'day' }],
            [6 * DAY, { value: 6, unit: 'day' }],
            [6.5 * DAY, { value: 1, unit: 'week' }],
            [7 * DAY, { value: 1, unit: 'week' }],
        ])('%d ms ahead', (offset, expected) => {
            expect(from(offset)).toEqual(expected);
        });
    });

    it('rounds symmetrically into the past', () => {
        expect(from(-59.5 * SECOND)).toEqual({ value: -1, unit: 'minute' });
        expect(from(-59.4 * SECOND)).toEqual({ value: -59, unit: 'second' });
        expect(from(-23.5 * HOUR)).toEqual({ value: -1, unit: 'day' });
        expect(from(-6.5 * DAY)).toEqual({ value: -1, unit: 'week' });
    });

    describe('weeks', () => {
        pinUtc();

        it('covers the gap up to a whole calendar month', () => {
            expect(from(7 * DAY)).toEqual({ value: 1, unit: 'week' });
            expect(from(20 * DAY)).toEqual({ value: 3, unit: 'week' });
            expect(from(25 * DAY)).toEqual({ value: 4, unit: 'week' });
        });

        it('never reaches five, in a long month or a short one', () => {
            // March has 31 days: the 30th day is still inside the month.
            expect(selectUnit(at('2024-03-01T00:00:00Z'), at('2024-03-31T00:00:00Z'))).toEqual({
                value: 4,
                unit: 'week',
            });
            expect(selectUnit(at('2024-02-01T00:00:00Z'), at('2024-02-28T00:00:00Z'))).toEqual({
                value: 4,
                unit: 'week',
            });
        });
    });

    describe('calendar months', () => {
        pinUtc();

        it('counts a month as a month whatever its length', () => {
            // 28, 30 and 31 days, all "1 month".
            expect(selectUnit(at('2023-02-01T00:00:00Z'), at('2023-03-01T00:00:00Z'))).toEqual({
                value: 1,
                unit: 'month',
            });
            expect(selectUnit(at('2024-04-10T00:00:00Z'), at('2024-05-10T00:00:00Z'))).toEqual({
                value: 1,
                unit: 'month',
            });
            expect(selectUnit(at('2024-01-10T00:00:00Z'), at('2024-02-10T00:00:00Z'))).toEqual({
                value: 1,
                unit: 'month',
            });
        });

        it('clamps a day-of-month that the target month does not have', () => {
            // Jan 31 + 1 month is Feb 28/29, not Mar 2.
            expect(selectUnit(at('2023-01-31T00:00:00Z'), at('2023-02-28T00:00:00Z'))).toEqual({
                value: 1,
                unit: 'month',
            });
            expect(selectUnit(at('2024-01-31T00:00:00Z'), at('2024-02-29T00:00:00Z'))).toEqual({
                value: 1,
                unit: 'month',
            });
        });

        it('stays just under a month one day early', () => {
            expect(selectUnit(at('2024-04-10T00:00:00Z'), at('2024-05-09T00:00:00Z'))).toEqual({
                value: 4,
                unit: 'week',
            });
        });

        it('runs to eleven before switching to years', () => {
            expect(selectUnit(at('2024-01-01T00:00:00Z'), at('2024-12-01T00:00:00Z'))).toEqual({
                value: 11,
                unit: 'month',
            });
            expect(selectUnit(at('2024-01-01T00:00:00Z'), at('2024-12-20T00:00:00Z'))).toEqual({
                value: 1,
                unit: 'year',
            });
        });

        it('counts backwards the same way', () => {
            expect(selectUnit(at('2024-03-15T00:00:00Z'), at('2024-01-15T00:00:00Z'))).toEqual({
                value: -2,
                unit: 'month',
            });
            expect(selectUnit(at('2023-03-01T00:00:00Z'), at('2023-02-01T00:00:00Z'))).toEqual({
                value: -1,
                unit: 'month',
            });
        });

        it('reads a clamped end-of-month pair the same way round', () => {
            // Jan 31 + 1 month clamps to Feb 29, but Feb 29 - 1 month is Jan 29:
            // anchoring on `from` made this pair "1 month" one way and
            // "4 weeks" the other.
            const jan31 = at('2024-01-31T00:00:00Z');
            const feb29 = at('2024-02-29T00:00:00Z');

            expect(selectUnit(jan31, feb29)).toEqual({ value: 1, unit: 'month' });
            expect(selectUnit(feb29, jan31)).toEqual({ value: -1, unit: 'month' });
        });

        it('is antisymmetric across month lengths and rounding ties', () => {
            const pairs = [
                ['2024-01-01T00:00:00Z', '2024-02-15T12:00:00Z'],
                ['2024-01-31T00:00:00Z', '2024-03-01T00:00:00Z'],
                ['2023-02-28T00:00:00Z', '2023-04-15T00:00:00Z'],
                ['2024-07-31T00:00:00Z', '2025-06-30T00:00:00Z'],
                ['2024-08-31T00:00:00Z', '2024-09-30T00:00:00Z'],
            ] as const;

            for (const [a, b] of pairs) {
                const forward = selectUnit(at(a), at(b));
                const backward = selectUnit(at(b), at(a));

                expect(backward).toEqual({ value: -forward.value, unit: forward.unit });
            }
        });
    });

    describe('years', () => {
        pinUtc();

        it('treats a leap year and a common year alike', () => {
            expect(selectUnit(at('2024-02-29T00:00:00Z'), at('2025-02-28T00:00:00Z'))).toEqual({
                value: 1,
                unit: 'year',
            });
            expect(selectUnit(at('2023-06-01T00:00:00Z'), at('2024-06-01T00:00:00Z'))).toEqual({
                value: 1,
                unit: 'year',
            });
        });

        it('does not drift over long spans', () => {
            // 365.25-day years would put this at 10 by now.
            expect(selectUnit(at('2000-01-01T00:00:00Z'), at('2010-01-01T00:00:00Z'))).toEqual({
                value: 10,
                unit: 'year',
            });
            expect(selectUnit(at('2024-01-01T00:00:00Z'), at('1974-01-01T00:00:00Z'))).toEqual({
                value: -50,
                unit: 'year',
            });
        });
    });

    it('is pure: no clock access, order-independent', () => {
        const a = selectUnit(NOW, NOW + 3 * HOUR);
        const b = selectUnit(NOW, NOW + 3 * HOUR);

        expect(a).toEqual(b);
        expect(selectUnit(NOW + 3 * HOUR, NOW)).toEqual({ value: -3, unit: 'hour' });
    });
});

describe('selectUnit options', () => {
    describe('validation', () => {
        it('rejects a non-finite timestamp instead of returning NaN', () => {
            expect(() => selectUnit(NaN, NOW)).toThrow(TypeError);
            expect(() => selectUnit(NOW, Number.POSITIVE_INFINITY)).toThrow(/^relative-time-lite:/);
        });

        it('rejects an unknown unit', () => {
            expect(() =>
                selectUnit(NOW, NOW, { minUnit: 'fortnight' as unknown as 'day' })
            ).toThrow(RangeError);
        });

        it('rejects a range that runs backwards', () => {
            expect(() => selectUnit(NOW, NOW, { minUnit: 'month', maxUnit: 'day' })).toThrow(
                RangeError
            );
        });
    });

    describe('rounding', () => {
        it('floors towards zero, keeping the unit it is still inside', () => {
            expect(from(59.5 * SECOND, { rounding: 'floor' })).toEqual({
                value: 59,
                unit: 'second',
            });
            expect(from(-59.9 * MINUTE, { rounding: 'floor' })).toEqual({
                value: -59,
                unit: 'minute',
            });
        });

        it('reaches the next unit only once the unit is whole', () => {
            expect(from(23.9 * HOUR, { rounding: 'floor' })).toEqual({ value: 23, unit: 'hour' });
            expect(from(24 * HOUR, { rounding: 'floor' })).toEqual({ value: 1, unit: 'day' });
        });

        it('never reports a negative zero', () => {
            expect(Object.is(from(-400, { rounding: 'floor' }).value, 0)).toBe(true);
            expect(Object.is(from(-400).value, 0)).toBe(true);
        });
    });

    describe('minUnit', () => {
        it('expresses anything finer in the finest allowed unit', () => {
            expect(from(30 * SECOND, { minUnit: 'minute' })).toEqual({ value: 1, unit: 'minute' });
            expect(from(20 * SECOND, { minUnit: 'minute' })).toEqual({ value: 0, unit: 'minute' });
            expect(from(3 * HOUR, { minUnit: 'day' })).toEqual({ value: 0, unit: 'day' });
        });

        it('leaves coarser distances alone', () => {
            expect(from(3 * HOUR, { minUnit: 'minute' })).toEqual({ value: 3, unit: 'hour' });
        });
    });

    describe('maxUnit', () => {
        it('expresses anything coarser in the coarsest allowed unit', () => {
            expect(from(90 * DAY, { maxUnit: 'day' })).toEqual({ value: 90, unit: 'day' });
            expect(from(400 * DAY, { maxUnit: 'month' })).toEqual({ value: 13, unit: 'month' });
            expect(from(3 * HOUR, { maxUnit: 'second' })).toEqual({
                value: 10_800,
                unit: 'second',
            });
        });

        it('leaves finer distances alone', () => {
            expect(from(3 * HOUR, { maxUnit: 'day' })).toEqual({ value: 3, unit: 'hour' });
        });

        it('skips the calendar entirely when months are out of range', () => {
            expect(from(45 * DAY, { maxUnit: 'week' })).toEqual({ value: 6, unit: 'week' });
        });
    });

    describe('justNowSeconds', () => {
        it('collapses a short distance to zero, in either direction', () => {
            expect(from(20 * SECOND, { justNowSeconds: 45 })).toEqual({
                value: 0,
                unit: 'second',
            });
            expect(from(-44 * SECOND, { justNowSeconds: 45 })).toEqual({
                value: 0,
                unit: 'second',
            });
        });

        it('lets the ladder take over at the edge of the window', () => {
            expect(from(45 * SECOND, { justNowSeconds: 45 })).toEqual({
                value: 45,
                unit: 'second',
            });
        });

        it('ignores a window that is not a positive number', () => {
            expect(from(-20 * SECOND, { justNowSeconds: Number.NaN })).toEqual({
                value: -20,
                unit: 'second',
            });
            expect(from(-20 * SECOND, { justNowSeconds: -45 })).toEqual({
                value: -20,
                unit: 'second',
            });
        });

        it('reports the collapse in the finest allowed unit', () => {
            expect(from(20 * SECOND, { justNowSeconds: 45, minUnit: 'minute' })).toEqual({
                value: 0,
                unit: 'minute',
            });
        });
    });

    it('combines a floor, a window and a clamped ladder', () => {
        expect(
            from(50 * DAY, {
                rounding: 'floor',
                justNowSeconds: 30,
                minUnit: 'hour',
                maxUnit: 'week',
            })
        ).toEqual({ value: 7, unit: 'week' });
    });
});
