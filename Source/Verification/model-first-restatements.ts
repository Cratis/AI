// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

interface InstructionFile {
    path: string;
    content: string;
}

// Only the invariant and its owning executable workflow may explain the test.
const owners = new Map([
    ['.cratis/ai/rules/general.md', 'The universal rule defines opt-in and acceptance.'],
    ['.cratis/ai/skills/cratis-screenplay-modeling-lifecycle/SKILL.md', 'The owning workflow explains the script inputs and verdicts.'],
]);

export function modelFirstRestatements(files: InstructionFile[]): { problems: string[]; scanned: number } {
    const subjects = files.filter(file => /\.md$/.test(file.path)
        && /^\.cratis\/ai\/(skills|rules|agents|prompts|harnesses)\//.test(file.path)
        && !owners.has(file.path));
    const problems: string[] = [];
    if (!subjects.length) problems.push('No instructions scanned for model-first restatements; the check would pass vacuously.');
    for (const file of subjects) {
        let line = 1;
        for (const block of file.content.split(/(\n\s*\n)/)) {
            const text = block.replace(/[`*>]/g, '').replace(/\s+/g, ' ');
            const treeTest = /\bls-tree\b/.test(text) && /\.play\b/.test(text);
            const proseTest = /(?:opted[- ]in|opt-in)/i.test(text) && (
                /(?:root|folder).{0,120}(?:holds|contains).{0,60}(?:committed|accepted).{0,30}\.play/i.test(text)
                || (/(?:only when|means|counts as|opts|opted in if)/i.test(text)
                    && /(?:explicitly|project).{0,40}(?:set|configured).{0,40}mcpServers\.screenplay\.root/i.test(text)));
            if (treeTest || proseTest) {
                problems.push(`${file.path}:${line} restates the model-first opt-in test; point to general.md "Model first" and, where installed, cratis-screenplay-modeling-lifecycle's scripts/model-first-status.mjs instead.`);
            }
            line += block.split('\n').length - 1;
        }
    }
    return { problems, scanned: subjects.length };
}
