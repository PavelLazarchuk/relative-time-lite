import { formatAt, toMs } from './format';
import type { DateInput, RelativeTimeOptions, RelativeTimeUnit } from './types';

export interface RelativeTimeStore {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => string;
}

const refreshMs = (unit: RelativeTimeUnit) =>
    unit === 'second'
        ? 1_000
        : unit === 'minute'
          ? 30_000
          : unit === 'hour'
            ? 1_800_000
            : 3_600_000;

const watchers = new Set<() => void>();
let listening = false;

const onVisibilityChange = () => {
    for (const watcher of [...watchers]) watcher();
};

/**
 * A live view of one timestamp: re-formats on its own schedule and notifies
 * only when the text actually changes.
 *
 * Each tick schedules the next one from the unit currently displayed, so a
 * "5 seconds ago" ticks every second while a "3 months ago" wakes hourly.
 * Ticks are suspended while the tab is hidden and caught up on return.
 *
 * Nothing is retained after the last unsubscribe: the timer is cleared and the
 * store is dropped by the caller. (A `WeakRef` around listeners was considered
 * and rejected: GC timing would decide when a visible timestamp stops
 * updating, which is worse than an explicit unsubscribe.)
 */
export function createRelativeTimeStore(
    date: DateInput,
    options: RelativeTimeOptions = {}
): RelativeTimeStore {
    const target = toMs(date);
    const base = options.now === undefined ? undefined : toMs(options.now);
    const listeners = new Set<() => void>();

    let snapshot: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const compute = () => formatAt(target, base ?? Date.now(), options);

    const schedule = (unit: RelativeTimeUnit) => {
        clearTimeout(timer);
        timer = undefined;

        if (typeof document !== 'undefined' && document.hidden) return;

        timer = setTimeout(tick, refreshMs(unit));
    };

    function tick() {
        const { text, unit } = compute();

        if (base === undefined) schedule(unit);

        if (text === snapshot) return;

        const notify = snapshot !== undefined;
        snapshot = text;

        if (notify) for (const listener of [...listeners]) listener();
    }

    const onVisibility = () => {
        if (document.hidden) {
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
                watchers.add(onVisibility);

                if (typeof document !== 'undefined' && !listening) {
                    document.addEventListener('visibilitychange', onVisibilityChange);
                    listening = true;
                }

                tick();
            }

            return () => {
                listeners.delete(listener);
                if (listeners.size) return;

                clearTimeout(timer);
                timer = undefined;
                watchers.delete(onVisibility);

                if (listening && !watchers.size) {
                    document.removeEventListener('visibilitychange', onVisibilityChange);
                    listening = false;
                }
            };
        },

        getSnapshot() {
            if (snapshot === undefined) snapshot = compute().text;

            return snapshot;
        },
    };
}
