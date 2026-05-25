import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/types/**/*.ts'],
            // thresholds: {
            //     lines: 80,
            //     branches: 80,
            //     functions: 80,
            //     statements: 80,
            // },
        },
    },
});
