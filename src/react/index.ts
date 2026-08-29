import { useMemo, useSyncExternalStore } from 'react';

import { toMs } from '../format';
import { createRelativeTimeStore } from '../store';
import type { DateInput, RelativeTimeOptions } from '../types';

/**
 * A relative timestamp that keeps itself current: "just now" becomes
 * "1 minute ago" without the component doing anything.
 *
 * Backed by `useSyncExternalStore`, so the clock stays the single source of
 * truth and the component re-renders only when the text actually changes.
 * The server snapshot is the same computation, which keeps hydration quiet as
 * long as client and server agree on the locale.
 */
export function useRelativeTime(date: DateInput, options: RelativeTimeOptions = {}): string {
    const { locale, style, numeric, now } = options;

    const target = toMs(date);
    const base = now === undefined ? undefined : toMs(now);

    const localeIsList = typeof locale !== 'string';
    const localeKey = typeof locale === 'string' ? locale : (locale ?? []).join('\u0000');

    const store = useMemo(() => {
        const tags = localeIsList ? (localeKey ? localeKey.split('\u0000') : undefined) : localeKey;

        return createRelativeTimeStore(target, { locale: tags, style, numeric, now: base });
    }, [target, localeIsList, localeKey, style, numeric, base]);

    return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export type { DateInput, RelativeTimeOptions, RelativeTimeUnit } from '../types';
