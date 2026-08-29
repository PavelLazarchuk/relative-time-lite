import { describe, expectTypeOf, it } from 'vitest';

import { createRelativeTimeStore, relativeTime, selectUnit } from '../src/index';
import type { RelativeTimeOptions, RelativeTimeUnit } from '../src/index';

describe('public types', () => {
    it('accepts every documented date input', () => {
        expectTypeOf(relativeTime).toBeCallableWith(new Date());
        expectTypeOf(relativeTime).toBeCallableWith(0);
        expectTypeOf(relativeTime).toBeCallableWith('2024-01-01');
        expectTypeOf(relativeTime(0)).toBeString();
    });

    it('constrains the option values', () => {
        expectTypeOf<RelativeTimeOptions['style']>().toEqualTypeOf<
            'long' | 'short' | 'narrow' | undefined
        >();
        expectTypeOf<RelativeTimeOptions['numeric']>().toEqualTypeOf<
            'always' | 'auto' | undefined
        >();
        expectTypeOf<RelativeTimeOptions['locale']>().toEqualTypeOf<
            string | readonly string[] | undefined
        >();
    });

    it('returns a unit Intl.RelativeTimeFormat accepts', () => {
        expectTypeOf(selectUnit(0, 1)).toEqualTypeOf<{ value: number; unit: RelativeTimeUnit }>();
        expectTypeOf<RelativeTimeUnit>().toExtend<Intl.RelativeTimeFormatUnit>();
    });

    it('exposes a store shaped for useSyncExternalStore', () => {
        const store = createRelativeTimeStore(0);

        expectTypeOf(store.getSnapshot).toEqualTypeOf<() => string>();
        expectTypeOf(store.subscribe).toEqualTypeOf<(listener: () => void) => () => void>();
    });
});
