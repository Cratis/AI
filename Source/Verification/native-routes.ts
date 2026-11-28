// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { markdownBlocks, markdownLinkDestinations } from './skill-structure.ts';

// A route names the language, its stack or its project artifact.
const artifact = {
    csharp: /\.csproj\b|C#|\.NET\b/i, typescript: /package\.json\b|\bTypeScript\b|\bNode\b/i, kotlin: /\.kts?\b|\bKotlin\b/i,
    java: /\.java\b|\bJava\b/i, go: /go\.mod\b|\bGo\b/i, elixir: /mix\.exs\b|\bElixir\b|\bOTP\b/i, python: /\bPython\b/i,
};

const hostTags = new Set('c# cs csharp dotnet ts typescript tsx js javascript jsx mjs cjs mts cts kt kotlin kts java go golang ex exs elixir py python'.split(' '));
const importLine = /^\s*(?:import\s+(?=[\w{*"'])|from\s+[\w.]+\s+import\s|(?:global\s+)?using\s+(?:static\s+)?[\w.]+\s*;)/m;
const condition = /\b(?:if|when|for|with)\b|[|→:–—]/i;
const boundary = /\b(?:unsupported|unavailable|no|not|doesn['’]t|cannot|can['’]t|boundary|only)\b/i;
const alternative = /\b(?:use|instead|via|through|call|keep|inspect|choose|run|ask|consume)\b/i;

function hasHostCode({ prose, code }: ReturnType<typeof markdownBlocks>): boolean {
    return prose.some(line => importLine.test(line)) || code.some(({ tag, lines }) => hostTags.has(tag) || lines.some(line => importLine.test(line)));
}

export function nativeRouteProblems(subject: string, body: string, files: string[]): string[] {
    const blocks = markdownBlocks(body);
    const problems = Object.entries(artifact).flatMap(([language, selects]) => {
        const path = `references/${language}.md`;
        if (files.includes(path)) {
            const routed = blocks.prose.filter(line => selects.test(line) && condition.test(line)).some(line =>
                markdownLinkDestinations(line).some(link => link.split('#')[0].replace(/^\.\//, '') === path));
            return routed ? [] : [`${subject} needs a read condition for '${path}'.`];
        }
        const stack = new RegExp(language === 'csharp' ? 'C#|\\.NET' : `\\b${language}\\b`, 'i');
        const gap = blocks.prose.filter(line => selects.test(line) || stack.test(line)).some(line => boundary.test(line) && alternative.test(line));
        return gap ? [] : [`${subject} needs '${path}' or a ${language} gap and alternative.`];
    });
    if (hasHostCode(blocks)) problems.push(`${subject} contains host code in a shared router.`);
    return problems;
}
