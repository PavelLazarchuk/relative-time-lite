import { describe, expect, it } from 'vitest';

import { selectUnit } from '../src/selectUnit';

const at = (iso: string) => new Date(iso).getTime();
const NOW = at('2024-03-15T12:00:00.000Z');

const from = (offsetMs: number) => selectUnit(NOW, NOW + offsetMs);

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
