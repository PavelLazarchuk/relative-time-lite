import { selectUnit } from './selectUnit';
import type { DateInput, RelativeTimeOptions, RelativeTimeResult } from './types';

export function toMs(input: DateInput): number {
    const ms =
        typeof input === 'number'
            ? input
            : typeof input === 'string'
              ? Date.parse(input)
              : input instanceof Date
                ? input.getTime()
                : NaN;

    if (!Number.isFinite(ms)) {
        throw new TypeError(`relative-time-lite: invalid date input: ${String(input)}`);
    }

    return ms;
}

const formatters = new Map<string, Intl.RelativeTimeFormat>();

const MAX_FORMATTERS = 64;

function getFormatter(options: RelativeTimeOptions): Intl.RelativeTimeFormat {
    const { locale, style = 'long', numeric = 'auto' } = options;

    const tags =
        typeof locale === 'string'
            ? `\u0001${locale}`
            : (locale ?? []).map(tag => `\u0002${tag}`).join('');
    const key = `${tags}\u0000${style}\u0000${numeric}`;

    let formatter = formatters.get(key);

    if (formatter) {
        formatters.delete(key);
    } else {
        formatter = new Intl.RelativeTimeFormat(locale as string | string[] | undefined, {
            style,
            numeric,
        });

        if (formatters.size >= MAX_FORMATTERS) {
            formatters.delete(formatters.keys().next().value as string);
        }
    }

    formatters.set(key, formatter);

    return formatter;
}

export function formatAt(
    targetMs: number,
    baseMs: number,
    options: RelativeTimeOptions
): RelativeTimeResult {
    const parts = selectUnit(baseMs, targetMs, options);

    return { ...parts, text: getFormatter(options).format(parts.value, parts.unit) };
}

/**
 * The same formatting as `relativeTime`, with the decision that produced it:
 * `{ value: -3, unit: 'minute', text: '3 minutes ago' }`.
 *
 * Saves re-deriving the unit when the markup needs more than the words — a
 * `<time>` element that also wants the unit, or a UI that drops to an absolute
 * date once the distance reaches years.
 */
export function relativeTimeParts(
    date: DateInput,
    options: RelativeTimeOptions = {}
): RelativeTimeResult {
    const base = options.now === undefined ? Date.now() : toMs(options.now);

    return formatAt(toMs(date), base, options);
}

/**
 * Formats a timestamp relative to now: "3 minutes ago", "in 2 months".
 *
 * The wording comes entirely from the runtime's `Intl.RelativeTimeFormat`, so
 * every locale the platform knows works without shipping any locale data.
 */
export function relativeTime(date: DateInput, options: RelativeTimeOptions = {}): string {
    return relativeTimeParts(date, options).text;
}
