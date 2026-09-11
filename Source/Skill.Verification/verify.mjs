import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '../..');
const scenarios = [];
async function discover(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await discover(path);
        if (entry.name === 'verification.json') scenarios.push(path);
    }
}
async function verify(path) {
    const scenario = JSON.parse(await readFile(path, 'utf8'));
    if (!scenario.skill || !scenario.input || !Array.isArray(scenario.assertions) || scenario.assertions.length === 0) {
        throw new Error(`${relative(root, path)} must define skill, input, and non-empty assertions`);
    }
    const skill = resolve(root, '.ai', 'skills', scenario.skill, 'SKILL.md');
    const content = await readFile(skill, 'utf8');
    for (const assertion of scenario.assertions) {
        if (assertion.kind !== 'skill-contains' || !content.includes(assertion.value)) {
            throw new Error(`${relative(root, path)}: assertion failed: ${JSON.stringify(assertion)}`);
        }
    }
    return { scenario: relative(root, path), skill: scenario.skill, digest: createHash('sha256').update(content).digest('hex') };
}
await discover(join(root, '.ai', 'skills'));
const results = await Promise.all(scenarios.map(verify));
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
