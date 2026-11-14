// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['src/**/for_*/**/*.ts'],
        exclude: ['**/given/**', '**/node_modules/**'],
        setupFiles: ['./src/vitest.setup.ts']
    }
});
