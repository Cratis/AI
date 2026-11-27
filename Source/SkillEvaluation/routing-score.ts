// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Result } from './Result.ts';
import type { Task } from './Task.ts';

type Metric = { matches: number; measured: number; planned: number; verdict: 'PASS' | 'FAIL' | 'INCOMPLETE' | 'N/A' };

export function routingScore(tasks: Task[], results: Result[]) {
    const confirmed = new Map(results.map(row => [row.key, row.confirmedSkills]));
    const positives = tasks.filter(task => task.shouldTrigger === true);
    const nearMisses = tasks.filter(task => task.shouldTrigger === false && typeof task.sibling === 'string');
    const unrelated = tasks.filter(task => task.shouldTrigger === false && task.sibling === null);
    return {
        positive: measure(positives, confirmed, targetLoaded, rate => rate >= 0.90),
        nearMiss: measure(nearMisses, confirmed, targetLoaded, rate => rate <= 0.10),
        unrelated: measure(unrelated, confirmed, (_, loaded) => loaded.length > 0, rate => rate <= 0.05),
        alternatives: alternativeLoads(nearMisses, confirmed),
    };
}

function measure(tasks: Task[], confirmed: Map<string, string[] | undefined>,
    matches: (task: Task, loaded: string[]) => boolean, meetsThreshold: (rate: number) => boolean): Metric {
    const measured = tasks.flatMap(task => {
        const loaded = confirmed.get(task.key);
        return loaded === undefined ? [] : [matches(task, loaded)];
    });
    const count = measured.filter(Boolean).length;
    return { matches: count, measured: measured.length, planned: tasks.length,
        verdict: verdict(tasks.length, measured.length, meetsThreshold(count / measured.length)) };
}

function verdict(planned: number, measured: number, meetsThreshold: boolean): Metric['verdict'] {
    if (!planned) return 'N/A';
    if (measured !== planned) return 'INCOMPLETE';
    return meetsThreshold ? 'PASS' : 'FAIL';
}

function targetLoaded(task: Task, loaded: string[]): boolean { return loaded.includes(task.skill); }

function alternativeLoads(tasks: Task[], confirmed: Map<string, string[] | undefined>): Map<string, number> {
    const counts = new Map<string, number>();
    for (const task of tasks) {
        const loaded = confirmed.get(task.key);
        if (!loaded || targetLoaded(task, loaded)) continue;
        for (const actual of loaded.length ? loaded : ['none']) {
            const route = `${task.sibling} → ${actual}`;
            counts.set(route, (counts.get(route) ?? 0) + 1);
        }
    }
    return counts;
}

export function routingSection(tasks: Task[], results: Result[]): string[] {
    const skills = [...new Set(tasks.map(task => task.skill))];
    const bySkill = skills.map(skill => ({ skill, score: routingScore(tasks.filter(task => task.skill === skill), results) }));
    return ['Confirmed loads only; denominators are repetitions, not majority votes. A near miss counts against the target; unrelated queries count any loaded corpus skill.', '',
        '| Skill | Positive ≥90% | Near miss ≤10% | Unrelated ≤5% | Verdict |', '|---|---|---|---|---|',
        routingRow('Overall', routingScore(tasks, results)),
        ...bySkill.map(({ skill, score }) => routingRow(skill, score)), '',
        'Near misses that did not load the target (expected sibling → observed alternative):',
        ...bySkill.map(({ skill, score }) => alternativeRow(skill, score.alternatives)), ''];
}

function routingRow(skill: string, { positive, nearMiss, unrelated }: ReturnType<typeof routingScore>): string {
    const verdicts = [positive.verdict, nearMiss.verdict, unrelated.verdict];
    return `| ${skill} | ${rateCell(positive)} | ${rateCell(nearMiss)} | ${rateCell(unrelated)} | ${combinedVerdict(verdicts)} |`;
}

function combinedVerdict(verdicts: Metric['verdict'][]): Metric['verdict'] {
    if (verdicts.includes('FAIL')) return 'FAIL';
    return verdicts.every(value => value === 'PASS') ? 'PASS' : 'INCOMPLETE';
}

function rateCell({ matches, measured, planned, verdict }: Metric): string {
    const rate = measured ? `${matches}/${measured} (${(100 * matches / measured).toFixed(1)}%)` : 'not measured';
    return `${rate} — ${verdict}${verdict === 'INCOMPLETE' ? ` (${measured}/${planned} measured)` : ''}`;
}

function alternativeRow(skill: string, alternatives: Map<string, number>): string {
    const counts = [...alternatives].sort(([a], [b]) => a.localeCompare(b)).map(([route, count]) => `${route} × ${count}`);
    return `- ${skill}: ${counts.join(', ') || 'no observed alternatives'}`;
}
