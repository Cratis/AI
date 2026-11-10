// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Grade } from './Grade.ts';
import type { Manifest } from './Manifest.ts';
import type { Result } from './Result.ts';
import { pendingTasks, uniqueByKey } from './storage.ts';

export function triggerPass(triggered: number, runs: number, shouldTrigger: boolean): { rate: number; passed: boolean } {
    if (runs < 1) throw new Error('Cannot compute a trigger rate over zero runs.');
    const rate = triggered / runs;
    return { rate, passed: (rate >= 0.5) === shouldTrigger };
}

export function statistics(values: number[]): { mean: number; standardDeviation: number } | undefined {
    if (!values.length) return undefined;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { mean, standardDeviation: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) };
}

function cell(value: string): string { return value.replaceAll('|', '\\|').replace(/\r?\n/g, ' '); }
function percentage(passed: number, total: number): string { return total ? `${passed}/${total} (${(100 * passed / total).toFixed(1)}%)` : 'not graded'; }
function metric(values: number[]): string {
    const summary = statistics(values);
    return summary ? `${summary.mean.toFixed(1)}${values.length > 1 ? ` ± ${summary.standardDeviation.toFixed(1)}` : ''}` : 'not recorded';
}

const distinct = <T>(values: T[]): T[] => [...new Set(values)];
const passedCount = (assertions: Array<{ passed: boolean }>) => assertions.filter(assertion => assertion.passed).length;

function triggerRows(manifest: Manifest, results: Result[], skill: string) {
    return distinct(manifest.tasks.filter(task => task.skill === skill).map(task => task.index)).map(index => {
        const tasks = manifest.tasks.filter(task => task.skill === skill && task.index === index);
        const runs = results.filter(result => result.skill === skill && result.index === index);
        const triggered = runs.filter(result => result.skillsRead.includes(skill)).length;
        return { index, tasks, runs, triggered, verdict: runs.length === tasks.length ? triggerPass(triggered, runs.length, tasks[0].shouldTrigger!) : undefined };
    });
}

type TriggerRow = ReturnType<typeof triggerRows>[number];

function verdictLabel(row: TriggerRow): string {
    if (!row.verdict) return 'INCOMPLETE';
    return row.verdict.passed ? 'PASS' : 'FAIL';
}

function loadedSkillCounts(row: TriggerRow): string {
    const counts = new Map<string, number>();
    for (const run of row.runs) for (const name of run.skillsRead) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].map(([name, count]) => `${name} × ${count}`).join(', ') || 'none';
}

function triggerRowLine(row: TriggerRow): string {
    return `| ${cell(row.tasks[0].prompt)} | ${row.tasks[0].shouldTrigger} | ${row.triggered}/${row.runs.length} | ${verdictLabel(row)} | ${loadedSkillCounts(row)} |`;
}

function triggerSection(manifest: Manifest, results: Result[], skill: string): string[] {
    const rows = triggerRows(manifest, results, skill);
    const lines = [`## ${skill}`, ''];
    for (const shouldTrigger of [true, false]) {
        const selected = rows.filter(row => row.tasks[0].shouldTrigger === shouldTrigger);
        lines.push(`${shouldTrigger ? 'Should-trigger' : 'Near-miss'}: ${percentage(selected.filter(row => row.verdict?.passed).length, selected.length)}`);
    }
    lines.push('', '| Query | Expected | Rate | Verdict | Skills loaded (counts) |', '|---|---|---|---|---|', ...rows.map(triggerRowLine));
    lines.push('', 'Failing queries:', ...rows.filter(row => row.verdict && !row.verdict.passed).map(row => `- ${cell(row.tasks[0].prompt)} — skills: ${distinct(row.runs.flatMap(run => run.skillsRead)).join(', ') || 'none'}`), '');
    return lines;
}

function assertionScore(rows: Result[], grades: Grade[]): string {
    const selected = grades.filter(grade => rows.some(row => row.key === grade.key)).flatMap(grade => grade.results);
    return percentage(passedCount(selected), selected.length);
}

/** Mean paired difference (with minus without skills) of one measure over the matching runs. */
function pairedDelta(withSkills: Result[], withoutSkills: Result[], select: (row: Result) => number | undefined): string {
    const values = withSkills.flatMap(row => {
        const baseline = withoutSkills.find(other => other.run === row.run);
        const withValue = select(row), withoutValue = baseline && select(baseline);
        return withValue !== undefined && withoutValue !== undefined ? [withValue - withoutValue] : [];
    });
    return metric(values);
}

function outputRow(results: Result[], grades: Grade[], skill: string, index: number): string {
    const rows = results.filter(result => result.skill === skill && result.index === index);
    const withSkills = rows.filter(row => row.withSkills);
    const withoutSkills = rows.filter(row => !row.withSkills);
    const delta = (select: (row: Result) => number | undefined) => pairedDelta(withSkills, withoutSkills, select);
    return `| ${skill}/${rows[0]?.name ?? index} | ${assertionScore(withSkills, grades)} | ${assertionScore(withoutSkills, grades)} | ${delta(row => row.usage?.input)} | ${delta(row => row.usage?.output)} | ${delta(row => row.durationSeconds)} |`;
}

function totalsLine(results: Result[], grades: Grade[], withSkills: boolean): string {
    const selected = results.filter(result => result.withSkills === withSkills);
    const assertions = grades.filter(grade => selected.some(row => row.key === grade.key)).flatMap(grade => grade.results);
    return `${withSkills ? 'With' : 'Without'} skills total: ${percentage(passedCount(assertions), assertions.length)}; mean seconds ${metric(selected.map(row => row.durationSeconds))}; mean input/output tokens ${metric(selected.flatMap(row => row.usage ? [row.usage.input] : []))}/${metric(selected.flatMap(row => row.usage ? [row.usage.output] : []))}.`;
}

function outputSection(manifest: Manifest, results: Result[], grades: Grade[]): string[] {
    const lines = ['## Outputs', '', `${grades.length}/${results.length} outputs graded. Ungraded assertions are unknown, not failures or passes.`, '',
        '| Task | With | Without | Δ input tokens | Δ output tokens | Δ seconds |', '|---|---|---|---|---|---|'];
    for (const skill of distinct(manifest.tasks.map(task => task.skill))) {
        for (const index of distinct(manifest.tasks.filter(task => task.skill === skill).map(task => task.index))) {
            lines.push(outputRow(results, grades, skill, index));
        }
    }
    lines.push('', 'Deltas are paired with minus without (mean ± population standard deviation for multiple runs). Tokens include cache reads and writes.', '');
    for (const withSkills of [true, false]) lines.push(totalsLine(results, grades, withSkills));
    lines.push('', '## Assertion discrimination', '', ...discrimination(results, grades));
    return lines;
}

export function report(manifest: Manifest, results: Result[], grades: Grade[]): string {
    grades = uniqueByKey(grades);
    const pending = pendingTasks(manifest.tasks, results);
    const lines = ['# Skill evaluation', '', `Harness: ${manifest.options.harness}/${manifest.options.model}. ${results.length}/${manifest.tasks.length} runs recorded.`,
        `Listing budget: ${manifest.options.listingBudget ?? 'default'}; thinking: ${manifest.options.thinking}; repetitions: ${manifest.options.runs}; timeout: ${manifest.options.timeout}s.`,
        'Trigger cutoff is the first skill load or six tool calls; prerequisite loads can prevent observing a later target load.',
        pending.length ? `Incomplete: ${pending.length} calls pending (not a pass).` : 'All requested calls recorded.',
        'Claude may retain bundled skills and usage-dependent listing truncation; pi has no listing budget. Compare like configurations.', ''];
    if (manifest.options.command === 'trigger') {
        for (const skill of distinct(manifest.tasks.map(task => task.skill))) lines.push(...triggerSection(manifest, results, skill));
    } else {
        lines.push(...outputSection(manifest, results, grades));
    }
    return lines.join('\n') + '\n';
}

type Pairs = Array<[boolean, boolean]>;

/** Pass/fail pairs (with, without) per assertion, in first-seen order, over the runs that have a baseline grade. */
function pairedAssertions(results: Result[], grades: Grade[]): Map<string, Pairs> {
    const grouped = new Map<string, Pairs>();
    for (const row of results.filter(result => result.withSkills)) {
        const baseline = results.find(other => other.skill === row.skill && other.index === row.index && other.run === row.run && !other.withSkills);
        const withGrade = grades.find(grade => grade.key === row.key);
        const withoutGrade = grades.find(grade => grade.key === baseline?.key);
        if (!withGrade || !withoutGrade) continue;
        withGrade.results.forEach((assertion, index) => {
            const key = `${row.skill}/${row.name}: ${assertion.text}`;
            const pairs = grouped.get(key) ?? [];
            pairs.push([assertion.passed, withoutGrade.results[index].passed]);
            grouped.set(key, pairs);
        });
    }
    return grouped;
}

function classify(pairs: Pairs, withCount: number, withoutCount: number): string {
    if (pairs.every(pair => pair[0] === pair[1])) return 'Non-discriminating';
    if (withCount > withoutCount) return 'Discriminating';
    return withCount < withoutCount ? 'Reverse' : 'Mixed';
}

function discrimination(results: Result[], grades: Grade[]): string[] {
    const grouped = pairedAssertions(results, grades);
    if (!grouped.size) return ['No paired grades yet.'];
    return [...grouped].map(([name, pairs]) => {
        const withCount = pairs.filter(pair => pair[0]).length, withoutCount = pairs.filter(pair => pair[1]).length;
        return `- ${classify(pairs, withCount, withoutCount)}: ${name} (with ${withCount}/${pairs.length}, without ${withoutCount}/${pairs.length})`;
    });
}
