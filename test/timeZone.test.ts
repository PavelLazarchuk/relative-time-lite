import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { relativeTime } from '../src/format';
import { selectUnit } from '../src/selectUnit';

const at = (iso: string) => new Date(iso).getTime();

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const ORIGINAL_TZ = process.env.TZ;

describe('timeZone', () => {
    beforeAll(() => {
        process.env.TZ = 'UTC';
    });

    afterAll(() => {
        process.env.TZ = ORIGINAL_TZ;
    });

    it('measures calendar months on the given zone, not the runtime one', () => {
        // 00:30 local Jan 31 to 00:45 local Feb 29 in Warsaw is one whole
        // calendar month; the same pair of instants read in UTC lands on Jan 30
        // and Feb 28, which is a few hours short of one and comes out in weeks.
        const from = at('2024-01-30T23:30:00Z');
        const to = at('2024-02-28T23:45:00Z');

        expect(selectUnit(from, to)).toEqual({ value: 4, unit: 'week' });
        expect(selectUnit(from, to, { timeZone: 'Europe/Warsaw' })).toEqual({
            value: 1,
            unit: 'month',
        });
    });

    it('follows the zone across its own daylight saving transition', () => {
        // Local midnight either side of the New York spring-forward: one month
        // on that calendar, 30 days and 23 hours to a runtime sitting in UTC.
        const from = at('2024-03-01T05:00:00Z');
        const to = at('2024-04-01T04:00:00Z');

        expect(selectUnit(from, to)).toEqual({ value: 4, unit: 'week' });
        expect(selectUnit(from, to, { timeZone: 'America/New_York' })).toEqual({
            value: 1,
            unit: 'month',
        });
    });

    it('reads a half-hour offset as half an hour', () => {
        // 05:30 puts the Kolkata date a day ahead of the UTC one here.
        const from = at('2024-01-30T20:00:00Z');
        const to = at('2024-02-29T20:15:00Z');

        expect(selectUnit(from, to, { timeZone: 'Asia/Kolkata' })).toEqual({
            value: 1,
            unit: 'month',
        });
    });

    it('takes a negative offset', () => {
        expect(
            selectUnit(at('2024-05-01T03:00:00Z'), at('2024-06-01T03:00:00Z'), {
                timeZone: 'America/Los_Angeles',
            })
        ).toEqual({ value: 1, unit: 'month' });
    });

    it('treats a zone sitting on UTC as no shift at all', () => {
        const from = at('2024-01-31T00:00:00Z');
        const to = at('2024-02-29T00:00:00Z');

        expect(selectUnit(from, to, { timeZone: 'UTC' })).toEqual(selectUnit(from, to));
    });

    it('leaves the elapsed-time units alone', () => {
        const from = at('2024-03-15T12:00:00Z');

        for (const timeZone of ['UTC', 'Asia/Kolkata', 'Pacific/Kiritimati']) {
            expect(selectUnit(from, from + 3 * HOUR, { timeZone })).toEqual({
                value: 3,
                unit: 'hour',
            });
            expect(selectUnit(from, from + 3 * DAY, { timeZone })).toEqual({
                value: 3,
                unit: 'day',
            });
        }
    });

    it('keeps years on the zone calendar too', () => {
        expect(
            selectUnit(at('2023-12-31T23:30:00Z'), at('2024-12-31T23:45:00Z'), {
                timeZone: 'Europe/Warsaw',
            })
        ).toEqual({ value: 1, unit: 'year' });
    });

    it('stays symmetric when the pair is read the other way round', () => {
        const from = at('2024-01-30T23:30:00Z');
        const to = at('2024-02-28T23:45:00Z');
        const options = { timeZone: 'Europe/Warsaw' };

        expect(selectUnit(to, from, options)).toEqual({ value: -1, unit: 'month' });
    });

    it('reaches relativeTime with everything else', () => {
        expect(
            relativeTime('2024-01-30T23:30:00Z', {
                locale: 'en',
                now: '2024-02-28T23:45:00Z',
                timeZone: 'Europe/Warsaw',
            })
        ).toBe('last month');
    });

    it('keeps answering correctly as the zone it is asked about changes', () => {
        const from = at('2024-01-30T23:30:00Z');
        const to = at('2024-02-28T23:45:00Z');

        // One formatter is memoised, so a run of different zones has to rebuild
        // it every time and still come back with each zone's own answer.
        for (let hour = -11; hour <= 11; hour += 1) {
            const timeZone = `Etc/GMT${hour < 0 ? '+' : '-'}${Math.abs(hour)}`;

            expect(selectUnit(from, to, { timeZone })).toEqual(
                hour >= 1 ? { value: 1, unit: 'month' } : { value: 4, unit: 'week' }
            );
        }

        expect(selectUnit(from, to, { timeZone: 'Europe/Warsaw' })).toEqual({
            value: 1,
            unit: 'month',
        });
    });

    it('rejects a zone the runtime does not know', () => {
        expect(() =>
            selectUnit(at('2024-01-01T00:00:00Z'), at('2024-06-01T00:00:00Z'), {
                timeZone: 'Middle/Earth',
            })
        ).toThrow(RangeError);
    });
});

describe('the runtime zone', () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const ANCHORS = [
        '2024-02-29T00:00:00Z', // a month boundary, on a leap year
        '2024-03-10T00:00:00Z', // New York springs forward
        '2024-04-07T00:00:00Z', // Lord Howe gives back its half hour
        '2024-11-03T00:00:00Z', // New York falls back
    ];

    it('is what the default path measures, exactly as naming it would', () => {
        for (const anchor of ANCHORS) {
            for (let minutes = -1500; minutes <= 1500; minutes += 30) {
                const to = at(anchor) + minutes * MINUTE;

                for (const span of [29 * DAY, 365 * DAY]) {
                    expect(selectUnit(to - span, to, { timeZone })).toEqual(
                        selectUnit(to - span, to)
                    );
                    expect(selectUnit(to, to - span, { timeZone })).toEqual(
                        selectUnit(to, to - span)
                    );
                }
            }
        }
    });
});
