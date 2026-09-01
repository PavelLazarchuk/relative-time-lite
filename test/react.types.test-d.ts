import { describe, expectTypeOf, it } from 'vitest';

import { useRelativeTime, useRelativeTimeParts } from '../src/react';
import type { RelativeTimeResult } from '../src/types';

declare const maybeDate: Date | null | undefined;

describe('react types', () => {
    it('accepts a missing date without widening the string it returns', () => {
        expectTypeOf(useRelativeTime).toBeCallableWith(maybeDate);
        expectTypeOf(useRelativeTime(0)).toBeString();
        expectTypeOf(useRelativeTime(maybeDate)).toBeString();
    });

    it('narrows the parts hook to non-null for a date that is certainly there', () => {
        expectTypeOf(useRelativeTimeParts(0)).toEqualTypeOf<RelativeTimeResult>();
        expectTypeOf(useRelativeTimeParts(maybeDate)).toEqualTypeOf<RelativeTimeResult | null>();
    });

    it('takes the store options the hook forwards', () => {
        expectTypeOf(useRelativeTime).toBeCallableWith(0, {
            locale: 'en',
            maxUnit: 'day',
            justNowSeconds: 45,
            refreshMs: 1000,
            trackVisibility: false,
        });
    });
});
