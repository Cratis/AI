// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Grade } from './Grade.ts';
import type { Task } from './Task.ts';

type Arm = NonNullable<Task['arm']>;
type Assertions = Grade['results'];

export function outputScore(tasks: Task[], grades: Grade[]) {
    const byKey = new Map(grades.map(grade => [grade.key, grade.results]));
    const arms = new Map(([ 'v2', 'none', 'v1' ] as const).flatMap(arm => {
        const selected = tasks.filter(task => task.arm === arm);
        return selected.length ? [[arm, summarize(selected, byKey)] as const] : [];
    }));
    const baseline = uplift(tasks, byKey, 'none');
    return { arms, baseline, comparison: uplift(tasks, byKey, 'v1'), verdict: e2Verdict(arms, baseline) };
}

function summarize(tasks: Task[], grades: Map<string, Assertions>) {
    const marked = tasks.flatMap(task => grades.get(task.key) ?? []);
    const failures = new Map<string, number>();
    for (const assertion of marked.filter(item => !item.passed)) {
        failures.set(assertion.text, (failures.get(assertion.text) ?? 0) + 1);
    }
    return { passed: passes(marked), total: marked.length, planned: tasks.reduce((sum, task) => sum + (task.assertions?.length ?? 0), 0),
        trials: tasks.length, failures };
}

function passes(assertions: Assertions): number { return assertions.filter(assertion => assertion.passed).length; }
function pairKey(task: Task): string { return JSON.stringify([task.skill, task.index, task.run, task.model]); }

function uplift(tasks: Task[], grades: Map<string, Assertions>, baseline: Arm) {
    const baselines = new Map(tasks.filter(task => task.arm === baseline).map(task => [pairKey(task), grades.get(task.key)]));
    const pairs = tasks.filter(task => task.arm === 'v2').flatMap(task => {
        const left = grades.get(task.key), right = baselines.get(pairKey(task));
        return left?.length && right?.length === left.length ? [{ delta: passes(left) - passes(right), total: left.length }] : [];
    });
    const total = pairs.reduce((sum, pair) => sum + pair.total, 0);
    return total ? { percentagePoints: 100 * pairs.reduce((sum, pair) => sum + pair.delta, 0) / total, pairs: pairs.length } : undefined;
}

export function outputMatrixSection(tasks: Task[], grades: Grade[]): string[] {
    const skills = [...new Set(tasks.map(task => task.skill))];
    const scores = skills.map(skill => ({ skill, score: outputScore(tasks.filter(task => task.skill === skill), grades) }));
    const compare = tasks.some(task => task.arm === 'v1');
    return ['Pass rate is the share of graded assertions. Uplift is v2 minus the comparison arm on matched, graded prompts and repetitions.', '',
        `| Skill | v2 | none | v2 − none | E2 verdict |${compare ? ' v1 | v2 − v1 |' : ''}`, `|---|---|---|---|---|${compare ? '---|---|' : ''}`,
        ...scores.map(({ skill, score }) => outputRow(skill, score, compare)), '',
        ...comparisonTopics(tasks, grades), '### Assertion failures by arm', '',
        ...scores.flatMap(({ skill, score }) => failureLines(skill, score)), ''];
}

function outputRow(skill: string, score: ReturnType<typeof outputScore>, compare: boolean): string {
    const { arms, baseline, comparison } = score;
    return `| ${skill} | ${rate(arms.get('v2'))} | ${rate(arms.get('none'))} | ${delta(baseline)} | ${score.verdict} |` +
        (compare ? ` ${rate(arms.get('v1'))} | ${delta(comparison)} |` : '');
}

function e2Verdict(arms: Map<Arm, ReturnType<typeof summarize>>, baseline: ReturnType<typeof uplift>): string {
    if (!baseline) return 'INCOMPLETE';
    if (!complete(arms.get('v2'), baseline.pairs)) return 'INCOMPLETE';
    if (!complete(arms.get('none'), baseline.pairs)) return 'INCOMPLETE';
    return baseline.percentagePoints > 0 ? 'PASS' : 'FAIL';
}

function complete(arm: ReturnType<typeof summarize> | undefined, pairs: number): boolean {
    if (!arm || pairs !== arm.trials) return false;
    return arm.total === arm.planned;
}

function comparisonTopics(tasks: Task[], grades: Grade[]): string[] {
    if (!tasks.some(task => task.arm === 'v1')) return [];
    const groups = new Map<string, Task[]>();
    for (const task of tasks) {
        const name = `${task.skill}/${task.index + 1} ${task.name ?? ''}`.trimEnd();
        const group = groups.get(name) ?? [];
        group.push(task);
        groups.set(name, group);
    }
    return ['### V1 comparison by topic', '', '| Topic | v2 | v1 | v2 − v1 |', '|---|---|---|---|',
        ...[...groups].map(([name, group]) => {
            const { arms, comparison } = outputScore(group, grades);
            return `| ${name} | ${rate(arms.get('v2'))} | ${rate(arms.get('v1'))} | ${delta(comparison)} |`;
        }), ''];
}

function rate(arm: ReturnType<typeof summarize> | undefined): string {
    if (!arm?.total) return 'not graded';
    const progress = arm.total < arm.planned ? ` (${arm.total}/${arm.planned} graded)` : '';
    return `${arm.passed}/${arm.total} (${(100 * arm.passed / arm.total).toFixed(1)}%)${progress}`;
}

function delta(value: ReturnType<typeof uplift>): string {
    return value ? `${value.percentagePoints > 0 ? '+' : ''}${value.percentagePoints.toFixed(1)} pp (${value.pairs} pairs)` : 'not graded';
}

function failureLines(skill: string, score: ReturnType<typeof outputScore>): string[] {
    return [...score.arms].flatMap(([arm, summary]) => [...summary.failures].map(([text, count]) =>
        `- ${skill} (${arm}): ${text.replace(/\r?\n/g, ' ')} × ${count}`));
}
