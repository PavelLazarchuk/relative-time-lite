import { describe, expectTypeOf, it } from 'vitest';

import { createRelativeTimeStore, relativeTime, relativeTimeParts, selectUnit } from '../src/index';
import type {
    RelativeTimeOptions,
    RelativeTimeResult,
    RelativeTimeUnit,
    SelectUnitOptions,
} from '../src/index';

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
        expectTypeOf(store.getParts).toEqualTypeOf<() => RelativeTimeResult>();
    });

    it('constrains the ladder options', () => {
        expectTypeOf<SelectUnitOptions['minUnit']>().toEqualTypeOf<RelativeTimeUnit | undefined>();
        expectTypeOf<SelectUnitOptions['maxUnit']>().toEqualTypeOf<RelativeTimeUnit | undefined>();
        expectTypeOf<SelectUnitOptions['rounding']>().toEqualTypeOf<
            'round' | 'floor' | undefined
        >();
        expectTypeOf<SelectUnitOptions['justNowSeconds']>().toEqualTypeOf<number | undefined>();
        expectTypeOf<RelativeTimeOptions>().toExtend<SelectUnitOptions>();
    });

    it('takes the same ladder options everywhere', () => {
        expectTypeOf(selectUnit).toBeCallableWith(0, 1, { maxUnit: 'day' });
        expectTypeOf(relativeTime).toBeCallableWith(0, { minUnit: 'minute' });
        expectTypeOf(relativeTimeParts(0)).toEqualTypeOf<RelativeTimeResult>();
        expectTypeOf(relativeTimeParts(0).text).toBeString();
        expectTypeOf(relativeTimeParts(0).unit).toEqualTypeOf<RelativeTimeUnit>();
    });
});
