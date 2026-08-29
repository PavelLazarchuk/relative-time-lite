import type { RelativeTimeParts } from './types';

const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 604_800_000;

const round = (n: number) => (n < 0 ? -Math.round(-n) : Math.round(n));

const addMonths = (date: Date, months: number) => {
    const shifted = new Date(date.getTime());
    const day = shifted.getDate();

    shifted.setDate(1);
    shifted.setMonth(shifted.getMonth() + months);
    shifted.setDate(
        Math.min(day, new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate())
    );

    return shifted;
};

/**
 * Signed distance in calendar months, fractional. Whole months come from the
 * calendar (so February counts as one month, leap year or not) and the
 * remainder is scaled by the length of the month actually being crossed.
 *
 * Always measured forward from the earlier instant, so a pair of timestamps
 * differs only in sign whichever way round it is read. Anchoring on `from`
 * instead would not: the clamp in `addMonths` is not invertible, since Jan 31
 * plus a month is Feb 29 while Feb 29 minus a month is Jan 29.
 */
function monthsBetween(fromMs: number, toMs: number): number {
    const sign = toMs < fromMs ? -1 : 1;
    const startMs = sign < 0 ? toMs : fromMs;
    const endMs = sign < 0 ? fromMs : toMs;

    const start = new Date(startMs);
    const end = new Date(endMs);

    let whole = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    let anchor = addMonths(start, whole).getTime();

    while (anchor > endMs) {
        whole -= 1;
        anchor = addMonths(start, whole).getTime();
    }

    const span = addMonths(start, whole + 1).getTime() - anchor;

    return sign * (whole + (span ? (endMs - anchor) / span : 0));
}

/**
 * Picks the coarsest unit that still describes `toMs` in a single number.
 * Pure: same inputs, same output, no clock access.
 *
 * Sub-month units are elapsed-time based (a day is 24 hours, DST included);
 * months and years are calendar based.
 */
export function selectUnit(fromMs: number, toMs: number): RelativeTimeParts {
    const diff = toMs - fromMs;

    const seconds = round(diff / SECOND);
    if (Math.abs(seconds) < 60) return { value: seconds, unit: 'second' };

    const minutes = round(diff / MINUTE);
    if (Math.abs(minutes) < 60) return { value: minutes, unit: 'minute' };

    const hours = round(diff / HOUR);
    if (Math.abs(hours) < 24) return { value: hours, unit: 'hour' };

    const days = round(diff / DAY);
    if (Math.abs(days) < 7) return { value: days, unit: 'day' };

    const months = monthsBetween(fromMs, toMs);
    if (Math.abs(months) < 1) return { value: round(diff / WEEK), unit: 'week' };

    const wholeMonths = round(months);
    if (Math.abs(wholeMonths) < 12) return { value: wholeMonths, unit: 'month' };

    return { value: round(months / 12), unit: 'year' };
}
