export interface ScheduledTask {
    due: number;
}

const tasks = new Map<ScheduledTask, () => void>();

let timer: ReturnType<typeof setTimeout> | undefined;

function rearm() {
    let next: ScheduledTask | undefined;

    for (const task of tasks.keys()) if (!next || task.due < next.due) next = task;

    if (timer !== undefined) clearTimeout(timer);

    timer = next ? setTimeout(flush, Math.max(next.due - Date.now(), 1)) : undefined;
}

function flush() {
    timer = undefined;

    const now = Date.now();
    const due: (() => void)[] = [];

    for (const [task, run] of tasks) {
        if (task.due > now) continue;

        tasks.delete(task);
        due.push(run);
    }

    rearm();

    for (const run of due) run();
}

/** Runs `run` in `delay` ms, on the shared timer. */
export function schedule(run: () => void, delay: number): ScheduledTask {
    const task = { due: Date.now() + delay };

    tasks.set(task, run);
    rearm();

    return task;
}

/** Cancels a scheduled task. Safe to call twice, and on one that already ran. */
export function cancel(task: ScheduledTask | undefined) {
    if (task && tasks.delete(task)) rearm();
}
