import type { RelativeTimeParts, RelativeTimeUnit, SelectUnitOptions } from './types';

const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 604_800_000;

const UNITS: RelativeTimeUnit[] = [
    'second',
    'minute',
    'hour',
    'day',
    'week',
    'month',
    'quarter',
    'year',
];

const round = (n: number) => (n < 0 ? -Math.round(-n) : Math.round(n));

const quantize = (n: number, floor: boolean) => (floor ? Math.trunc(n) : round(n)) || 0;

const OFFSET = /([+-])(\d+):?(\d\d)?/;

let zoneTag: string | undefined;
let zoneFormat: Intl.DateTimeFormat;

/**
 * How far `timeZone` is from UTC at `ms`, in milliseconds — the zone's own
 * rules at that instant, so a DST transition is on the right side of it.
 *
 * `longOffset` is asked for the answer directly, so the formatted string ends
 * in "GMT+01:00" and the only signed number in it is the one wanted. Reading
 * it off is both smaller and less locale-dependent than reassembling the
 * calendar fields by hand; a zone sitting exactly on UTC may say a bare "GMT",
 * which matches nothing and reads back as the zero it is.
 *
 * One formatter is kept, not a map of them: a page renders one zone, and the
 * alternative is a cache that grows on whatever strings it is handed.
 */
function zoneOffset(ms: number, timeZone: string): number {
    if (timeZone !== zoneTag) {
        zoneFormat = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
        zoneTag = timeZone;
    }

    const [, sign, hours = '0', minutes = '0'] = OFFSET.exec(zoneFormat.format(ms)) ?? [];

    return sign ? (sign === '-' ? -MINUTE : MINUTE) * (+hours * 60 + +minutes) : 0;
}

/**
 * The instant as a wall clock: an epoch whose *UTC* fields read back as the
 * calendar date and time seen in `timeZone`, or in the runtime's own zone when
 * there is none. Calendar arithmetic then runs on UTC getters alone, which
 * have no zone of their own to disagree with.
 */
const toWall = (ms: number, timeZone: string | undefined) =>
    ms +
    (timeZone === undefined
        ? -new Date(ms).getTimezoneOffset() * MINUTE
        : zoneOffset(ms, timeZone));

/** `wall` moved by whole calendar months, clamping Jan 31 + 1 month to Feb 28/29. */
function addMonths(wall: number, months: number): number {
    const date = new Date(wall);
    const day = date.getUTCDate();

    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);

    const month = date.getUTCMonth();

    date.setUTCDate(day);

    if (date.getUTCMonth() !== month) date.setUTCDate(0);

    return date.getTime();
}

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
function monthsBetween(fromMs: number, toMs: number, timeZone: string | undefined): number {
    const sign = toMs < fromMs ? -1 : 1;
    const startMs = toWall(sign < 0 ? toMs : fromMs, timeZone);
    const endMs = toWall(sign < 0 ? fromMs : toMs, timeZone);

    const start = new Date(startMs);
    const end = new Date(endMs);

    let whole =
        (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        end.getUTCMonth() -
        start.getUTCMonth();
    let anchor = addMonths(startMs, whole);

    if (anchor > endMs) {
        whole -= 1;
        anchor = addMonths(startMs, whole);
    }

    const span = addMonths(startMs, whole + 1) - anchor;

    return sign * (whole + (span ? (endMs - anchor) / span : 0));
}

/**
 * Picks the coarsest unit that still describes `toMs` in a single number.
 * Pure: same inputs, same output, no clock access.
 *
 * Sub-month units are elapsed-time based (a day is 24 hours, DST included);
 * months, quarters and years are calendar based, in `timeZone` if one is given
 * and the runtime's own zone otherwise.
 *
 * `minUnit` and `maxUnit` clamp the ladder from either end, so the distance is
 * expressed in the nearest allowed unit rather than the natural one. Quarters
 * are only ever reached through them: the unclamped ladder steps from months
 * straight to years, since "in 2 quarters" is not how most UIs read a date.
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
        timeZone,
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

    const months = hi > 4 ? monthsBetween(fromMs, toMs, timeZone) : 0;

    if (lo <= 4) {
        const value = quantize(diff / WEEK, floor);
        if (hi === 4 || Math.abs(months) < 1) return { value, unit: 'week' };
    }

    if (lo <= 5) {
        const value = quantize(months, floor);
        if (hi === 5 || Math.abs(value) < 12) return { value, unit: 'month' };
    }

    if (lo <= 6) {
        const value = quantize(months / 3, floor);
        if (hi === 6 || (lo === 6 && Math.abs(value) < 4)) return { value, unit: 'quarter' };
    }

    return { value: quantize(months / 12, floor), unit: 'year' };
}
