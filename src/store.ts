import { formatAt, toMs } from './format';
import type {
    DateInput,
    RelativeTimeParts,
    RelativeTimeResult,
    RelativeTimeStoreOptions,
    RelativeTimeUnit,
} from './types';

export interface RelativeTimeStore {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => string;
    getParts: () => RelativeTimeResult;
}

const MIN_DELAY = 250;

const MAX_DELAY = 2_147_483_647;

const STEP: Record<RelativeTimeUnit, number> = {
    second: 1_000,
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_629_746_000,
    year: 31_556_952_000,
};

const clamp = (ms: number) =>
    Number.isFinite(ms) ? Math.min(Math.max(ms, MIN_DELAY), MAX_DELAY) : MIN_DELAY;

/**
 * How long the current text is still going to be the right one.
 *
 * The displayed number changes when `diff` crosses the rounding edge below it:
 * halfway to the next value when rounding, the value itself when truncating.
 * For the fixed-length units that edge is exact — a "2 hours ago" sleeps until
 * the very moment it becomes "3 hours ago", not until the next slot on a
 * half-hourly grid — and it doubles as the ladder's own boundary, since the
 * switch to a coarser unit happens at exactly the same crossing.
 *
 * Weeks, months and years have no fixed length, so the same arithmetic on an
 * average-length unit is an estimate rather than an edge. Sleeping half of it
 * converges on the crossing from below instead of risking a late wake-up: a
 * handful of no-op checks per transition, none of which notifies anyone.
 */
function nextDelay(
    diff: number,
    { value, unit }: RelativeTimeParts,
    options: RelativeTimeStoreOptions
): number {
    const { rounding = 'round', justNowSeconds = 0 } = options;
    const justNowMs = justNowSeconds * 1000;

    // The window ends once the distance grows back to `justNowSeconds`, which is
    // `justNowMs + diff` away whichever side of now the target sits on: a target
    // still `diff` in the future has to reach now first, and only then drift out.
    if (Math.abs(diff) < justNowMs) return clamp(justNowMs + diff);

    const step = STEP[unit];
    const edge = rounding === 'floor' ? (value > 0 ? value : value - 1) : value - 0.5;
    const delay = diff - edge * step;

    if (step < STEP.week) return clamp(delay);

    return clamp(delay > 0 ? delay / 2 : step / 64);
}

const watchers = new Set<() => void>();
let listening = false;

const notifyWatchers = () => {
    for (const watcher of [...watchers]) watcher();
};

const RESYNC_EVENTS = ['focus', 'pageshow'] as const;

const startListening = () => {
    if (listening) return;

    document.addEventListener('visibilitychange', notifyWatchers);

    const view = document.defaultView;

    if (view) for (const event of RESYNC_EVENTS) view.addEventListener(event, notifyWatchers);

    listening = true;
};

const stopListening = () => {
    if (!listening) return;

    document.removeEventListener('visibilitychange', notifyWatchers);

    const view = document.defaultView;

    if (view) for (const event of RESYNC_EVENTS) view.removeEventListener(event, notifyWatchers);

    listening = false;
};

/**
 * A live view of one timestamp: re-formats on its own schedule and notifies
 * only when the text actually changes.
 *
 * Each tick schedules the next one for the moment the text is due to change,
 * so a "5 seconds ago" wakes every second while a "3 days ago" sleeps for
 * twelve hours. Ticks are suspended while the tab is hidden and caught up on
 * return, on a window focus, and on a restore from the back/forward cache.
 *
 * Nothing is retained after the last unsubscribe: the timer is cleared and the
 * store is dropped by the caller. (A `WeakRef` around listeners was considered
 * and rejected: GC timing would decide when a visible timestamp stops
 * updating, which is worse than an explicit unsubscribe.)
 */
export function createRelativeTimeStore(
    date: DateInput,
    options: RelativeTimeStoreOptions = {}
): RelativeTimeStore {
    const { refreshMs, trackVisibility = true } = options;

    const target = toMs(date);
    const base = options.now === undefined ? undefined : toMs(options.now);
    const listeners = new Set<() => void>();

    const live = base === undefined;

    let current: RelativeTimeResult | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const hidden = () =>
        trackVisibility && typeof document !== 'undefined' && document.hidden === true;

    const schedule = (diff: number, parts: RelativeTimeParts) => {
        clearTimeout(timer);
        timer = undefined;

        if (hidden()) return;

        timer = setTimeout(
            tick,
            refreshMs === undefined ? nextDelay(diff, parts, options) : clamp(refreshMs)
        );
    };

    function tick() {
        const now = base ?? Date.now();
        const result = formatAt(target, now, options);

        if (live) schedule(target - now, result);

        if (current?.text === result.text) return;

        const notify = current !== undefined;
        current = result;

        if (notify) for (const listener of [...listeners]) listener();
    }

    /**
     * While nothing is subscribed there are no ticks to keep `current` honest,
     * so a live store re-reads the clock on demand rather than serving the text
     * it happened to compute first. The cached object survives whenever the
     * words are unchanged, which is the identity `getParts` promises and the
     * stability `useSyncExternalStore` requires between a render and its
     * subscription.
     */
    const read = () => {
        if (current === undefined) return (current = formatAt(target, base ?? Date.now(), options));

        if (live && !listeners.size) {
            const next = formatAt(target, Date.now(), options);

            if (next.text !== current.text) current = next;
        }

        return current;
    };

    const resync = () => {
        if (hidden()) {
            clearTimeout(timer);
            timer = undefined;
        } else if (listeners.size) {
            tick();
        }
    };

    return {
        subscribe(listener) {
            listeners.add(listener);

            if (listeners.size === 1) {
                if (live && trackVisibility && typeof document !== 'undefined') {
                    watchers.add(resync);
                    startListening();
                }

                tick();
            }

            return () => {
                listeners.delete(listener);
                if (listeners.size) return;

                clearTimeout(timer);
                timer = undefined;

                if (watchers.delete(resync) && !watchers.size) stopListening();
            };
        },

        getSnapshot() {
            return read().text;
        },

        getParts() {
            return read();
        },
    };
}
