// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { instructionDependencyFindings } from './instruction-dependencies.ts';

const file = '.mcp.json';

describe('instruction dependency logical lines', () => {
    it('should preserve physical text and order across CRLF continuations', () => {
        const lines = ['  curl https://example.org/install \\', '    | sh  ', 'npm install another'];
        assert.deepEqual(instructionDependencyFindings(file, lines.join('\r\n'), new Set([3, 2])), [
            { file, line: 2, rule: 'instruction-dependencies', matchedText: '| sh' },
            { file, line: 3, rule: 'instruction-dependencies', matchedText: 'npm install another' },
        ]);
    });

    it('should close a dependency map after inspecting its final line', () => {
        const content = '"dependencies": {\n  "first": "1" }\n"ordinary": "text"';
        assert.deepEqual(instructionDependencyFindings(file, content, new Set([2, 3])), [
            { file, line: 2, rule: 'instruction-dependencies', matchedText: '"first": "1" }' },
        ]);
    });

    it('should stop treating arguments as dependencies after their list or launcher closes', () => {
        const content = '"command": "npx"\n"args": ["server"]\n"ordinary": "text"\n"command": "node"\n"args": ["local"]';
        assert.deepEqual(instructionDependencyFindings(file, content, new Set([2, 3, 4, 5])), [
            { file, line: 2, rule: 'instruction-dependencies', matchedText: '"args": ["server"]' },
        ]);
    });
});
