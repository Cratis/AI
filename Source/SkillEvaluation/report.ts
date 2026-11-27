// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Grade } from './Grade.ts';
import type { Manifest } from './Manifest.ts';
import type { Result } from './Result.ts';
import { pendingTasks, uniqueByKey } from './storage.ts';
import { routingSection } from './routing-score.ts';
import { outputMatrixSection } from './output-score.ts';

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
        const measured = runs.filter(result => result.confirmedSkills !== undefined);
        const triggered = measured.filter(result => result.confirmedSkills!.includes(skill)).length;
        return { index, tasks, runs, measured, triggered, verdict: measured.length === tasks.length ? triggerPass(triggered, measured.length, tasks[0].shouldTrigger!) : undefined };
    });
}

type TriggerRow = ReturnType<typeof triggerRows>[number];

function verdictLabel(row: TriggerRow): string {
    if (!row.verdict) return 'INCOMPLETE';
    return row.verdict.passed ? 'PASS' : 'FAIL';
}

function skillCounts(runs: Result[], select: (run: Result) => string[]): string {
    const counts = new Map<string, number>();
    for (const run of runs) for (const name of select(run)) counts.set(name, (counts.get(name) ?? 0) + 1);
    return [...counts].map(([name, count]) => `${name} × ${count}`).join(', ') || 'none';
}

function siblingsFirst(run: Result): string[] {
    const skills = run.confirmedSkills ?? [];
    const target = skills.indexOf(run.skill);
    return target < 0 ? skills : skills.slice(0, target);
}

function triggerRowLine(row: TriggerRow): string {
    const attempts = skillCounts(row.measured, run => run.attemptedSkills ?? []);
    const confirmed = skillCounts(row.measured, run => run.confirmedSkills!);
    const siblings = skillCounts(row.measured, siblingsFirst);
    const rate = row.measured.length ? `${row.triggered}/${row.measured.length}` : 'not measured';
    return `| ${cell(row.tasks[0].prompt)} | ${row.tasks[0].shouldTrigger} | ${rate} | ${verdictLabel(row)} | ${attempts} | ${confirmed} | ${siblings} |`;
}

function triggerSection(manifest: Manifest, results: Result[], skill: string): string[] {
    const rows = triggerRows(manifest, results, skill);
    const lines = [`## ${skill}`, ''];
    for (const shouldTrigger of [true, false]) {
        const selected = rows.filter(row => row.tasks[0].shouldTrigger === shouldTrigger);
        lines.push(`${shouldTrigger ? 'Should-trigger' : 'Near-miss'}: ${percentage(selected.filter(row => row.verdict?.passed).length, selected.length)}`);
    }
    lines.push('', '| Query | Expected | Confirmed target rate | Verdict | Attempts (counts) | Confirmed skills (counts) | Sibling-first loads (counts) |', '|---|---|---|---|---|---|---|', ...rows.map(triggerRowLine));
    lines.push('', 'Failing queries:', ...rows.filter(row => row.verdict && !row.verdict.passed).map(row => `- ${cell(row.tasks[0].prompt)} — skills: ${distinct(row.measured.flatMap(run => run.confirmedSkills!)).join(', ') || 'none'}`), '');
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
    if (manifest.options.corpus === 'v2' || manifest.options.models) return matrixReport(manifest, results, uniqueByKey(grades));
    return legacyReport(manifest, results, uniqueByKey(grades));
}

function matrixReport(manifest: Manifest, results: Result[], grades: Grade[]): string {
    const { options } = manifest;
    const lines = ['# Skill evaluation', '', `${options.command}; ${options.corpus ?? 'v1'} corpus; ${options.harness}; ${results.length}/${manifest.tasks.length} trials recorded.`,
        `Thinking: ${options.thinking}; repetitions: ${options.runs}; timeout: ${options.timeout}s.`, ''];
    for (const model of options.models ?? [options.model]) {
        const tasks = manifest.tasks.filter(task => (task.model ?? options.model) === model);
        const keys = new Set(tasks.map(task => task.key));
        const measured = results.filter(row => keys.has(row.key));
        const marked = grades.filter(row => keys.has(row.key));
        lines.push(`## ${cell(model)}`, '', `${measured.length}/${tasks.length} trials recorded.`, '');
        lines.push(...matrixSection({ ...manifest, tasks, options: { ...options, model } }, measured, marked), ...telemetry(measured));
    }
    return lines.join('\n') + '\n';
}

function matrixSection(manifest: Manifest, results: Result[], grades: Grade[]): string[] {
    if (manifest.options.corpus !== 'v2') return legacyReport(manifest, results, grades).trimEnd().split('\n');
    return manifest.options.command === 'trigger' ? routingSection(manifest.tasks, results) : outputMatrixSection(manifest.tasks, grades);
}

function telemetry(results: Result[]): string[] {
    const lines = ['', '### Telemetry (means per recorded trial)', '', '| Arm | Input tokens | Output tokens | Tool calls | Seconds |', '|---|---|---|---|---|'];
    const arms = distinct(results.map(armOf));
    return [...lines, ...arms.map(arm => telemetryRow(arm, results.filter(row => armOf(row) === arm))), ''];
}

function armOf(row: Result): string { return row.arm ?? (row.withSkills ? 'v1' : 'none'); }

function telemetryRow(arm: string, results: Result[]): string {
    const inputs = metric(results.flatMap(row => row.usage ? [row.usage.input] : []));
    const outputs = metric(results.flatMap(row => row.usage ? [row.usage.output] : []));
    const tools = metric(results.flatMap(row => row.toolCalls === undefined ? [] : [row.toolCalls]));
    return `| ${arm} | ${inputs} | ${outputs} | ${tools} | ${metric(results.map(row => row.durationSeconds))} |`;
}

function legacyReport(manifest: Manifest, results: Result[], grades: Grade[]): string {
    const pending = pendingTasks(manifest.tasks, results);
    const lines = ['# Skill evaluation', '', `Harness: ${manifest.options.harness}/${manifest.options.model}. ${results.length}/${manifest.tasks.length} runs recorded.`,
        `Listing budget: ${manifest.options.listingBudget ?? 'default'}; thinking: ${manifest.options.thinking}; repetitions: ${manifest.options.runs}; timeout: ${manifest.options.timeout}s.`,
        `Corpus condition: ${manifest.corpusCondition ?? 'isolated-skills (legacy)'}; baseline: none.`,
        'Trigger cutoff waits for a confirmed target skill load or six tool calls (pending skill attempts finish before the cap). Sibling loads do not stop the run.',
        'Only matched successful loads count toward confirmed target rates. Historical results without confirmation fields are unmeasured, not rescored.',
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
