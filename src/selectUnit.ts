import type { RelativeTimeParts, RelativeTimeUnit, SelectUnitOptions } from './types';

const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 604_800_000;

const UNITS: RelativeTimeUnit[] = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];

const round = (n: number) => (n < 0 ? -Math.round(-n) : Math.round(n));

const quantize = (n: number, floor: boolean) => (floor ? Math.trunc(n) : round(n)) || 0;

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

    if (anchor > endMs) {
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
 * months and years are calendar based, in the runtime's local time zone.
 *
 * `minUnit` and `maxUnit` clamp the ladder from either end, so the distance is
 * expressed in the nearest allowed unit rather than the natural one.
 */
export function selectUnit(
    fromMs: number,
    toMs: number,
    options: SelectUnitOptions = {}
): RelativeTimeParts {
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
        throw new TypeError(`relative-time-lite: invalid timestamps: ${fromMs}, ${toMs}`);
    }

    const {
        minUnit = 'second',
        maxUnit = 'year',
        rounding = 'round',
        justNowSeconds = 0,
    } = options;

    const lo = UNITS.indexOf(minUnit);
    const hi = UNITS.indexOf(maxUnit);

    if (lo < 0 || hi < 0 || lo > hi) {
        throw new RangeError(`relative-time-lite: invalid unit range: ${minUnit}..${maxUnit}`);
    }

    const diff = toMs - fromMs;
    const floor = rounding === 'floor';

    if (justNowSeconds > 0 && Math.abs(diff) < justNowSeconds * SECOND) {
        return { value: 0, unit: minUnit };
    }

    if (lo === 0) {
        const value = quantize(diff / SECOND, floor);
        if (hi === 0 || Math.abs(value) < 60) return { value, unit: 'second' };
    }

    if (lo <= 1) {
        const value = quantize(diff / MINUTE, floor);
        if (hi === 1 || Math.abs(value) < 60) return { value, unit: 'minute' };
    }

    if (lo <= 2) {
        const value = quantize(diff / HOUR, floor);
        if (hi === 2 || Math.abs(value) < 24) return { value, unit: 'hour' };
    }

    if (lo <= 3) {
        const value = quantize(diff / DAY, floor);
        if (hi === 3 || Math.abs(value) < 7) return { value, unit: 'day' };
    }

    const months = hi > 4 ? monthsBetween(fromMs, toMs) : 0;

    if (lo <= 4) {
        const value = quantize(diff / WEEK, floor);
        if (hi === 4 || Math.abs(months) < 1) return { value, unit: 'week' };
    }

    if (lo <= 5) {
        const value = quantize(months, floor);
        if (hi === 5 || Math.abs(value) < 12) return { value, unit: 'month' };
    }

    return { value: quantize(months / 12, floor), unit: 'year' };
}
