import {
    createContext,
    createElement,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import { formatAt, toMs, tryToMs } from '../format';
import { createRelativeTimeStore } from '../store';
import type { RelativeTimeStore } from '../store';
import type {
    DateInput,
    RelativeTimeResult,
    RelativeTimeStoreOptions,
    UseRelativeTimeOptions,
} from '../types';

const noop = () => {};

const NO_PARTS: RelativeTimeResult = { value: 0, unit: 'second', text: '' };

const EMPTY_STORE: RelativeTimeStore = {
    subscribe: () => noop,
    getSnapshot: () => '',
    getParts: () => NO_PARTS,
    setDate: noop,
    setOptions: noop,
};

const useApplyEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

interface HydrationDefaults {
    now?: number;
    hydrationText?: string;
}

const HydrationContext = createContext<HydrationDefaults>({});

export interface RelativeTimeProviderProps {
    now?: DateInput;
    hydrationText?: string;
    children?: ReactNode;
}

export function RelativeTimeProvider({ now, hydrationText, children }: RelativeTimeProviderProps) {
    const base = now === undefined ? undefined : toMs(now);

    const value = useMemo<HydrationDefaults>(
        () => ({ now: base, hydrationText }),
        [base, hydrationText]
    );

    return createElement(HydrationContext.Provider, { value }, children);
}

function useServerParts(
    target: number | undefined,
    storeOptions: RelativeTimeStoreOptions,
    options: UseRelativeTimeOptions
): RelativeTimeResult | undefined {
    const defaults = useContext(HydrationContext);

    const own = options.hydrationText !== undefined || options.serverNow !== undefined;

    const text = own ? options.hydrationText : defaults.hydrationText;
    const base = own ? options.serverNow : defaults.now;
    const serverNow = base === undefined ? undefined : toMs(base);

    return useMemo(() => {
        if (target === undefined) return undefined;

        if (text !== undefined) return { value: 0, unit: 'second', text };

        if (serverNow === undefined) return undefined;

        return formatAt(target, serverNow, storeOptions);
    }, [target, text, serverNow, storeOptions]);
}

function useRelativeTimeStore(
    date: DateInput | null | undefined,
    options: UseRelativeTimeOptions
): [RelativeTimeStore, RelativeTimeResult | undefined] {
    const {
        locale,
        style,
        numeric,
        now,
        minUnit,
        maxUnit,
        rounding,
        justNowSeconds,
        justNowText,
        timeZone,
        format,
        refreshMs,
        trackVisibility,
    } = options;

    const target = date === null || date === undefined ? undefined : tryToMs(date);
    const base = now === undefined ? undefined : toMs(now);

    const localeIsList = typeof locale !== 'string';
    const localeKey = typeof locale === 'string' ? locale : (locale ?? []).join('\u0000');

    const storeOptions = useMemo(() => {
        const tags = localeIsList ? (localeKey ? localeKey.split('\u0000') : undefined) : localeKey;

        return {
            locale: tags,
            style,
            numeric,
            now: base,
            minUnit,
            maxUnit,
            rounding,
            justNowSeconds,
            justNowText,
            timeZone,
            format,
            refreshMs,
            trackVisibility,
        } satisfies RelativeTimeStoreOptions;
    }, [
        localeIsList,
        localeKey,
        style,
        numeric,
        base,
        minUnit,
        maxUnit,
        rounding,
        justNowSeconds,
        justNowText,
        timeZone,
        format,
        refreshMs,
        trackVisibility,
    ]);

    const ref = useRef<RelativeTimeStore | null>(null);
    const applied = useRef(storeOptions);

    if (ref.current === null && target !== undefined) {
        ref.current = createRelativeTimeStore(target, storeOptions);
        applied.current = storeOptions;
    }

    const store = target === undefined ? EMPTY_STORE : (ref.current as RelativeTimeStore);
    const serverParts = useServerParts(target, storeOptions, options);

    useApplyEffect(() => {
        if (target === undefined || ref.current === null) return;

        ref.current.setDate(target);

        if (applied.current !== storeOptions) {
            applied.current = storeOptions;
            ref.current.setOptions(storeOptions);
        }
    }, [target, storeOptions]);

    return [store, serverParts];
}

/**
 * A relative timestamp that keeps itself current: "just now" becomes
 * "1 minute ago" without the component doing anything.
 *
 * Backed by `useSyncExternalStore`, so the clock stays the single source of
 * truth and the component re-renders only when the text actually changes.
 * The server snapshot is the same computation, which keeps hydration quiet as
 * long as client and server agree on the locale.
 *
 * A `null` or `undefined` date renders an empty string, so a timestamp that
 * may not be there yet does not force a conditional hook, and neither does one
 * the platform cannot parse.
 */
export function useRelativeTime(
    date: DateInput | null | undefined,
    options: UseRelativeTimeOptions = {}
): string {
    const [store, serverParts] = useRelativeTimeStore(date, options);

    const getServerSnapshot = useMemo(
        () => (serverParts === undefined ? store.getSnapshot : () => serverParts.text),
        [store, serverParts]
    );

    return useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
}

/**
 * `useRelativeTime` with the decision behind the words: the live
 * `{ value, unit, text }`, for markup that needs the unit as well — a `<time>`
 * title, or a switch to an absolute date once the unit reaches years.
 *
 * The object is replaced only when the text changes, so it is safe to compare
 * by identity or to pass into a memo. `null` comes back for a missing or
 * unparsable date.
 */
export function useRelativeTimeParts(
    date: DateInput,
    options?: UseRelativeTimeOptions
): RelativeTimeResult;
export function useRelativeTimeParts(
    date: DateInput | null | undefined,
    options?: UseRelativeTimeOptions
): RelativeTimeResult | null;
export function useRelativeTimeParts(
    date: DateInput | null | undefined,
    options: UseRelativeTimeOptions = {}
): RelativeTimeResult | null {
    const [store, serverParts] = useRelativeTimeStore(date, options);

    const getServerParts = useMemo(
        () => (serverParts === undefined ? store.getParts : () => serverParts),
        [store, serverParts]
    );

    const parts = useSyncExternalStore(store.subscribe, store.getParts, getServerParts);

    return store === EMPTY_STORE ? null : parts;
}

export type {
    DateInput,
    RelativeTimeFormatInput,
    RelativeTimeFormatter,
    RelativeTimeOptions,
    RelativeTimeResult,
    RelativeTimeStoreOptions,
    RelativeTimeUnit,
    SelectUnitOptions,
    UseRelativeTimeOptions,
} from '../types';
