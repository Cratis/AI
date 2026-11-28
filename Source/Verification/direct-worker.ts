// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rulesForPath, universalRules } from '../../.cratis/ai/harnesses/pi/extensions/shared/rules.ts';
import { skillBody } from './skill-structure.ts';

// Direct v3.151.0 WorkerAIProfileContent.cs:29–55.
const workerLists = {
    'cratis/documentation': 'documentation documentation-structure-and-formatting editing-cratis-docs writing-correct-examples writing-cratis-docs',
    'cratis/engineering/csharp': 'general code-quality code-quality.csharp concepts csharp specs specs.csharp verification-discipline',
    'cratis/engineering/react': 'general code-quality code-quality.typescript typescript specs specs.typescript verification-discipline',
    'cratis/application/react': 'react components dialogs frontend-quality frontend-testing storybook',
    'cratis/application/csharp': 'vertical-slices reactors efcore efcore.specs specs.scenarios.csharp',
};

const directShims = new Set('verification-discipline specs concepts vertical-slices reactors specs.scenarios.csharp react components dialogs frontend-quality frontend-testing'.split(' ').map(name => `${name}.md`));

export function workerRuleProblems(readRule: (name: string) => string | undefined): string[] {
    return Object.entries(workerLists).flatMap(([id, list]) => {
        const missing = list.split(' ').map(name => `${name}.md`).filter(name => {
            const text = readRule(name);
            return text === undefined || !skillBody(text).replace(/^[ \t]*#+[^\n]*$/gm, '').replace(/<!--[^]*?-->/g, '').trim();
        });
        return missing.length ? [`${id} lacks rule text: ${missing.join(', ')}.`] : [];
    });
}

export function directWorkerProblems(root: string): string[] {
    return workerRuleProblems(name => {
        const path = join(root, '.cratis/ai/rules', name);
        return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
    });
}

export function shimBudgetProblems(root: string, paths: string[]): string[] {
    const universal = universalRules(root).filter(rule => directShims.has(rule.name));
    return [
        ...universal.map(rule => `Direct shim '${rule.name}' must be path scoped.`),
        ...paths.flatMap(path => {
            const matching = [...universal, ...rulesForPath(root, path).filter(rule => directShims.has(rule.name))];
            const bytes = matching.reduce((total, rule) => total + Buffer.byteLength(skillBody(rule.content)), 0);
            return bytes > 3_000 ? [`${path}: matching Direct shims total ${bytes} bytes (max 3,000).`] : [];
        }),
    ];
}
