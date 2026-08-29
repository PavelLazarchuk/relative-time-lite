export type DateInput = Date | number | string;

export type RelativeTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export interface RelativeTimeParts {
    value: number;
    unit: RelativeTimeUnit;
}

export interface RelativeTimeOptions {
    locale?: string | readonly string[];
    style?: 'long' | 'short' | 'narrow';
    numeric?: 'always' | 'auto';
    now?: DateInput;
}
