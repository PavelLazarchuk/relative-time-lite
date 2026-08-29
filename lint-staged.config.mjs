export default {
    '**/*.{ts,tsx}': ['prettier --write', 'eslint --fix --max-warnings=0', 'vitest related --run'],
    '**/*.mjs': ['prettier --write', 'eslint --fix --max-warnings=0'],
    '**/*.{json,md,yml,yaml}': ['prettier --write'],
};
