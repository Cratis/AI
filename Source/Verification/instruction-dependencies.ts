// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { AuthoringFinding } from './AuthoringFinding.ts';
import type { InstructionDependencyReport } from './InstructionDependencyReport.ts';
import { comparisonGit, instructionMergeBase } from './git-base.ts';

/** Include canonical instructions, executable hooks/configuration and the repository's native adapters. */
export function isInstructionFile(file: string): boolean {
    return /^(?:\.cratis\/ai\/|\.(?:claude|pi|agents|cursor|opencode)\/|\.github\/instructions(?:\/|$))/.test(file)
        || ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md'].includes(file);
}

const install = /\b(?:npm|yarn|pnpm|npx|bunx)\b[^\r\n`;&|]*?\b(?:install|add|dlx)\b|\b(?:npx|bunx)\s+\S+|\bpip(?:3)?\s+install\b|\bdotnet\s+(?:tool\s+install|add\s+package)\b|\bgo\s+(?:install|get)\b|\b(?:cargo|brew)\s+install\b|\bcurl\b[^\r\n]*\|\s*(?:(?:sudo|env)\s+)?(?:ba)?sh\b/i;
const source = /--(?:registry|source)\b|(?:extra-)?index-url\b|\bnuget\.org\b|\bregistry\.npmjs\.org\b|https?:\/\/[^\s<>"'`]*(?:registry|nuget|feeds?|packages|artifactory|nexus|pypi|\/v3\/index\.json|\/simple\b)[^\s<>"'`]*|(?:["'](?:registry|source|index-url)["']\s*:|<add\b[^>]*\bvalue=)[^\r\n]*https?:\/\//i;
const declaration = /<PackageReference\b|["'](?:devDependencies|peerDependencies|optionalDependencies|dependencies)["']\s*:|@[a-z0-9._-]+\/[a-z0-9._-]+/i;

/** Inspect only added lines, retaining unchanged surrounding dependency blocks and continued shell commands. */
export function instructionDependencyFindings(file: string, content: string, added: Set<number>): AuthoringFinding[] {
    const findings: AuthoringFinding[] = [];
    const lines = content.split(/\r?\n/);
    let dependencies = false;
    for (let index = 0; index < lines.length; index++) {
        const first = index;
        while (/\\\s*$/.test(lines[index]) && index + 1 < lines.length) index++;
        const text = lines.slice(first, index + 1).join('\n').replace(/\\\s*\n/g, ' ');
        if (/["'](?:devDependencies|peerDependencies|optionalDependencies|dependencies)["']\s*:\s*\{/.test(text)) dependencies = true;
        const suspicious = install.test(text) || source.test(text) || declaration.test(text)
            || (dependencies && /["'][^"']+["']\s*:/.test(text));
        if (suspicious) {
            for (let line = first + 1; line <= index + 1; line++) {
                if (added.has(line)) findings.push({ file, line, rule: 'instruction-dependencies', matchedText: lines[line - 1].trim() });
            }
        }
        if (dependencies && /}/.test(text)) dependencies = false;
    }
    return findings;
}

function addedLines(patch: string): Set<number> {
    const added = new Set<number>();
    let line: number | undefined;
    for (const text of patch.split('\n')) {
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
        if (hunk) line = Number(hunk[1]);
        else if (line !== undefined && text.startsWith('+')) added.add(line++);
        else if (line !== undefined && text.startsWith(' ')) line++;
    }
    return added;
}

/** Compare the working tree (including staged, unstaged and new unignored files) to the Git merge base. */
export function checkInstructionDependencies(root: string): InstructionDependencyReport {
    let base: string;
    try { base = instructionMergeBase(root); }
    catch { return { status: 'skipped', reason: 'no resolvable Git merge base' }; }
    try {
        const git = (...args: string[]) => comparisonGit(root, ...args);
        const changed = git('diff', '--name-only', '-z', '--no-renames', base, '--').split('\0').filter(isInstructionFile);
        const untracked = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(isInstructionFile);
        const files = [...new Set([...changed, ...untracked])];
        const findings = files.flatMap(file => {
            const path = join(root, file);
            let metadata;
            try { metadata = lstatSync(path); }
            catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
            // Review symlink targets as text; never follow an adapter into another checkout or outside the repository.
            const content = metadata.isSymbolicLink() ? readlinkSync(path) : readFileSync(path, 'utf8');
            const added = untracked.includes(file) ? new Set(content.split('\n').map((_, index) => index + 1))
                : addedLines(git('diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=0', base, '--', file));
            return instructionDependencyFindings(file, content, added);
        });
        return { status: 'checked', base, files: files.length, findings };
    } catch (error) {
        return { status: 'skipped', reason: `comparison unavailable: ${error instanceof Error ? error.message : String(error)}` };
    }
}

/** Escape GitHub workflow-command metacharacters so instruction text cannot inject another annotation. */
export function instructionDependencyWarning(finding: AuthoringFinding, ci: boolean): string {
    const escape = (text: string) => text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    const message = `Review instruction dependency/source: ${finding.matchedText}`;
    return ci ? `::warning file=${escape(finding.file).replaceAll(':', '%3A').replaceAll(',', '%2C')},line=${finding.line}::${escape(message)}`
        : `WARNING ${finding.file}:${finding.line} [${finding.rule}] ${message}`;
}

/** Advisory only: findings and unavailable comparisons never enter the verifier's failure list. */
export function instructionDependencyMessages(report: InstructionDependencyReport, ci: boolean): string[] {
    if (report.status === 'skipped') return [`Instruction dependency review: skipped (${report.reason}).`];
    return [`Instruction dependency review: ${report.files} changed instruction files, ${report.findings.length} warnings (base ${report.base}).`,
        ...report.findings.map(finding => instructionDependencyWarning(finding, ci))];
}
