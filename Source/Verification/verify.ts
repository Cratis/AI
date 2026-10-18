// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { constants, existsSync } from 'node:fs';
import { access, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { canonicalToolNames, checkOpenCodeAgents, parseCanonicalAgent } from '../Harness.Setup/opencode-agents.ts';
import { checkPiAgents } from '../Harness.Setup/pi-agents.ts';
import { checkCopilotInstructions } from '../Harness.Setup/copilot-instructions.ts';
import { toolsErrorFor } from '../../.cratis/ai/harnesses/pi/extensions/subagent/agents.ts';
import { frontmatter as sharedFrontmatter } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';
import { validateMcpServers } from './mcp-servers.ts';
import { loadProductSync, productSyncProblems, productSyncSummary } from './product-sync.ts';
import { verifyPlayExamples } from './play/index.ts';
import { summary as contractSummary, verifyContract } from './contract/index.ts';
import { unprofiledSkills } from './profiled-skills.ts';
import { verifySkillEvaluations } from './skill-evaluations.ts';
import { bundlePins, bundleTable, pinRestatements, pinSummary, scaffoldPins, scaffoldTable, type PinException } from './pin-restatements.ts';
import { danglingSkillReferences } from './skill-references.ts';
import { modelFirstRestatements } from './model-first-restatements.ts';
import { skillFrontmatterProblems } from './skill-paths.ts';
import { alwaysOnFindings, assetExceptions, assetReachabilityFindings, instructionAuthoringFindings, skillAuthoringFindings, skillAuthoringProblems, skillOverlapFindings } from './skill-authoring.ts';
import type { AuthoringFinding } from './AuthoringFinding.ts';
import { evaluationCoverageBaseline, evaluationCoverageFindings } from './evaluation-coverage.ts';
import { checkInstructionDependencies, instructionDependencyMessages } from './instruction-dependencies.ts';
import { skillHygieneFindings, skillHygieneProblems, skillHygieneReport } from './skill-hygiene.ts';
import { brokenRelativeLinkProblems, referenceContentsProblems, skillAssertionFileProblem, skillBody, skillContainsAssertionProblems, skillReferenceProblems, skillStructureProblems } from './skill-structure.ts';

interface Profile {
    id: string;
    composes?: string[];
    availableTargets?: string[];
    languages?: string[];
}
interface Scenario {
    skill: string;
    input: string;
    assertions: Array<{ kind: string; value: string; file?: string }>;
}

const root = resolve(process.argv[2] ?? '../..');
const corpus = join(root, '.cratis', 'ai');
const failures: string[] = [];
const scenarioResults: Array<{ scenario: string; skill: string; digest: string }> = [];
// Skill bodies are timeless: hygiene findings fail verification. SKILL_HYGIENE_MODE=warn reports them without failing.
const skillHygieneMode = process.env.SKILL_HYGIENE_MODE ?? 'fail';
const hygieneFindings: ReturnType<typeof skillHygieneFindings> = [];
const skillAuthoringMode = process.env.SKILL_AUTHORING_MODE ?? 'warn';
const authoringFindings: AuthoringFinding[] = [];

for (const message of instructionDependencyMessages(checkInstructionDependencies(root), process.env.GITHUB_ACTIONS === 'true')) {
    console.warn(message);
}

async function exists(path: string): Promise<boolean> {
    try {
        await access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function files(directory: string): Promise<string[]> {
    const discovered: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) discovered.push(...await files(path));
        else if (entry.isFile()) discovered.push(path);
    }
    return discovered;
}

/** The top-level frontmatter fields as strings, read by the shared parser so that indented (nested) keys are not counted. */
function frontmatter(content: string): Record<string, string> | undefined {
    const fields = sharedFrontmatter(content);
    return fields.size === 0 ? undefined : Object.fromEntries([...fields].map(([key, values]) => [key, values.join(', ')]));
}

function requireValues(actual: string[], required: string[], subject: string): void {
    for (const value of required) {
        if (!actual.includes(value)) failures.push(`${subject} is missing '${value}'.`);
    }
}

if (!await exists(corpus)) failures.push('Canonical corpus .cratis/ai is missing.');
const corpusTextPaths = (await files(corpus)).filter(path => ['.json', '.md', '.sh', '.ts'].some(extension => path.endsWith(extension)));
const modelFirstReport = modelFirstRestatements(await Promise.all(corpusTextPaths.filter(path => path.endsWith('.md'))
    .map(async path => ({ path: relative(root, path), content: await readFile(path, 'utf8') }))));
failures.push(...modelFirstReport.problems);
console.log(`Model-first restatements: ${modelFirstReport.scanned} instructions scanned, ${modelFirstReport.problems.length} problems.`);
const repositoryOnlyReferences = ['Source/Harness.Setup', 'Source/Verification', 'In this repository specifically', 'verify-ai-corpus.yml'];
for (const corpusPath of corpusTextPaths) {
    const content = await readFile(corpusPath, 'utf8');
    for (const reference of repositoryOnlyReferences) {
        if (content.includes(reference)) failures.push(`${relative(root, corpusPath)} leaks repository-only guidance '${reference}'.`);
    }
}
const authorityRule = await readFile(join(corpus, 'rules', 'capability-is-not-authority.md'), 'utf8');
if (!/The user\s+is sufficient authority/.test(authorityRule)) failures.push('Authority guidance must treat the user as sufficient authority for a direct request.');
if (!/never require a second approver/.test(authorityRule)) failures.push('Authority guidance must prohibit repeated approval ceremonies.');
if (await exists(join(root, '.ai'))) failures.push('Legacy .ai directory must not exist.');
if (await exists(join(root, '.cratis', 'PROJECT.md'))) failures.push('Legacy .cratis/PROJECT.md must not exist.');
for (const obsolete of ['tooling', 'evidence', 'evals', 'catalog', 'distribution', 'profiles', 'pilots', 'engineering']) {
    if (await exists(join(root, obsolete))) failures.push(`Obsolete root '${obsolete}' must not exist.`);
}
const workflows = (await readdir(join(root, '.github', 'workflows'))).filter(name => name.endsWith('.yml') || name.endsWith('.yaml'));
if (!workflows.includes('publish.yml')) failures.push('The publish workflow is required.');
// Release-note callers and the weekly product drift monitor accompany publishing.
const allowedWorkflows = ['publish.yml', 'verify-release-notes.yml', 'verify-semver-label.yml', 'product-drift.yml'];
const unexpectedWorkflows = workflows.filter(name => !allowedWorkflows.includes(name));
if (unexpectedWorkflows.length > 0) failures.push(`Only ${allowedWorkflows.join(', ')} are allowed; found ${unexpectedWorkflows.join(', ')}.`);
for (const marketplace of ['.claude-plugin/marketplace.json', '.cursor-plugin/marketplace.json', '.agents/plugins/marketplace.json', '.github/plugin/marketplace.json']) {
    const document = JSON.parse(await readFile(join(root, marketplace), 'utf8'));
    if (document.plugins?.length !== 1 || document.plugins[0]?.source?.path !== '.cratis/ai' || document.plugins[0]?.skills !== './skills') {
        failures.push(`${marketplace} must expose the canonical .cratis/ai/skills corpus.`);
    }
}
const requiredPiExtensions = ['cratis-hooks', 'cratis-rules', 'cratis-path-guidance', 'subagent', 'cratis-mcp'];
for (const extension of requiredPiExtensions) {
    if (!await exists(join(corpus, 'harnesses', 'pi', 'extensions', extension, 'index.ts'))) failures.push(`Pi extension '${extension}' is missing.`);
}
const subagentExtension = await readFile(join(corpus, 'harnesses', 'pi', 'extensions', 'subagent', 'index.ts'), 'utf8');
if (!subagentExtension.includes('params.confirmProjectAgents ?? false')) failures.push('Pi subagents must not prompt for project-agent confirmation by default.');
if (!subagentExtension.includes('Default false.')) failures.push('Pi subagent tool guidance must document its non-interrupting confirmation default.');
const piPackage = JSON.parse(await readFile(join(root, 'Source', 'Pi.Plugin', 'package.json'), 'utf8'));
if (piPackage.repository?.url !== 'https://github.com/Cratis/AI') failures.push('@cratis/pi repository.url must match its GitHub provenance repository.');
const packagedExtensions: string[] = piPackage.pi?.extensions ?? [];
for (const extension of [
    './src/index.ts',
    './package/corpus/harnesses/pi/extensions/cratis-hooks/index.ts',
    './package/corpus/harnesses/pi/extensions/subagent/index.ts',
    './package/corpus/harnesses/pi/extensions/cratis-mcp/index.ts',
    './package/corpus/harnesses/pi/extensions/cratis-path-guidance/index.ts',
]) {
    if (!packagedExtensions.includes(extension)) failures.push(`@cratis/pi does not load '${extension}'.`);
}

const manifest = JSON.parse(await readFile(join(corpus, 'manifest.json'), 'utf8'));
requireValues(manifest.harnesses ?? [], ['claude', 'codex', 'copilot', 'cursor', 'opencode', 'pi'], 'manifest harnesses');
requireValues(manifest.languages ?? [], ['csharp', 'typescript', 'kotlin', 'elixir'], 'manifest languages');
if (manifest.profileCatalog !== 'profile-catalog.json') failures.push("manifest profileCatalog must be 'profile-catalog.json'.");

const catalog = JSON.parse(await readFile(join(corpus, manifest.profileCatalog), 'utf8')) as { publicProfiles: Profile[]; engineeringProfiles: Profile[] };
const profiles = [...catalog.publicProfiles, ...catalog.engineeringProfiles];
const profileIds = new Set(profiles.map(profile => profile.id));
const mcpCatalogue = JSON.parse(await readFile(join(corpus, 'mcp-servers.json'), 'utf8')) as unknown;
failures.push(...validateMcpServers(mcpCatalogue, profileIds));
const declaredProfiles: string[] = manifest.profiles ?? [];
const catalogProfiles = [...profileIds].sort();
if (JSON.stringify(declaredProfiles) !== JSON.stringify(catalogProfiles)) failures.push('Manifest profiles must list every catalog profile in sorted order.');
const declaredLanguages: string[] = manifest.languages ?? [];
const catalogLanguages = [...new Set(profiles.flatMap(profile => profile.languages ?? []))].sort();
if (JSON.stringify(declaredLanguages) !== JSON.stringify(catalogLanguages)) failures.push('Manifest languages must list every catalog language in sorted order.');
for (const profile of profiles) {
    for (const composed of profile.composes ?? []) {
        if (!profileIds.has(composed)) failures.push(`Profile '${profile.id}' composes missing profile '${composed}'.`);
    }
    for (const skill of profile.availableTargets ?? []) {
        if (!await exists(join(corpus, 'skills', skill, 'SKILL.md'))) failures.push(`Profile '${profile.id}' references missing skill '${skill}'.`);
    }
}
for (const profile of manifest.profiles ?? []) {
    if (!profileIds.has(profile)) failures.push(`Manifest references missing profile '${profile}'.`);
}

const productSync = await loadProductSync(root);
const productReport = productSyncProblems(productSync.document, productSync.sources);
failures.push(...productReport.problems);
console.log(productSyncSummary(productReport));

const skillDirectories = (await readdir(join(corpus, 'skills'), { withFileTypes: true })).filter(entry => entry.isDirectory());
const skillEvaluations = await verifySkillEvaluations(root, skillDirectories.map(entry => entry.name));
failures.push(...skillEvaluations.problems);
const evaluatedSkills = (await readdir(join(root, 'Evaluations', 'skills'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
try {
    const baseline = evaluationCoverageBaseline(root);
    if (baseline === undefined) console.log('Evaluation coverage base comparison: skipped (no resolvable Git base); static coverage checks still run.');
    authoringFindings.push(...evaluationCoverageFindings(
        skillDirectories.map(entry => entry.name), evaluatedSkills,
        JSON.parse(await readFile(join(root, 'Evaluations', 'unevaluated.json'), 'utf8')),
        baseline));
} catch (error) {
    console.error(`Evaluation coverage could not run: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
}
for (const name of unprofiledSkills(skillDirectories.map(entry => entry.name), profiles)) {
    failures.push(`Skill '${name}' is not reachable from any profile.`);
}
// A rule, prompt or agent that names a skill with no directory sends the agent following it to load nothing.
const referencingFiles = await Promise.all(['rules', 'prompts', 'agents'].map(async directory => {
    const names = (await readdir(join(corpus, directory))).filter(name => name.endsWith('.md'));
    return Promise.all(names.map(async name => ({ path: `${directory}/${name}`, content: await readFile(join(corpus, directory, name), 'utf8') })));
}));
failures.push(...danglingSkillReferences(referencingFiles.flat(), skillDirectories.map(entry => entry.name)));
for (const entry of referencingFiles.flat()) authoringFindings.push(...instructionAuthoringFindings(`.cratis/ai/${entry.path}`, entry.content));
const copilotAdapterNames = (await readdir(join(corpus, 'harnesses', 'copilot', 'instructions'))).filter(name => name.endsWith('.md'));
const loadedArtifacts = {
    copilotAdapters: await Promise.all(copilotAdapterNames.map(async name => ({ file: name, content: await readFile(join(corpus, 'harnesses', 'copilot', 'instructions', name), 'utf8') }))),
    cursorRule: await readFile(join(corpus, 'harnesses', 'cursor', 'rules', 'cratis.mdc'), 'utf8'),
};
authoringFindings.push(...alwaysOnFindings(referencingFiles[0].map(entry => ({ file: `.cratis/ai/${entry.path}`, content: entry.content })), undefined, loadedArtifacts));
const overlapFindings = skillOverlapFindings(await Promise.all(corpusTextPaths.filter(path => /\/skills\/[^/]+\/SKILL\.md$/.test(path)).map(async path => ({
    file: relative(root, path), content: await readFile(path, 'utf8'),
}))));
console.log(`Skill trigger overlap: ${skillDirectories.length} skills scanned, ${overlapFindings.length} warnings.`);
for (const finding of overlapFindings) console.warn(`${finding.file}:${finding.line} [${finding.rule}] ${finding.matchedText}`);
authoringFindings.push(...overlapFindings);
for (const directory of skillDirectories) {
    const skillFile = join(corpus, 'skills', directory.name, 'SKILL.md');
    if (!await exists(skillFile)) {
        failures.push(`Skill directory '${directory.name}' has no SKILL.md.`);
        continue;
    }
    const skillContent = await readFile(skillFile, 'utf8');
    hygieneFindings.push(...skillHygieneFindings(relative(root, skillFile), skillContent));
    authoringFindings.push(...skillAuthoringFindings(relative(root, skillFile), skillContent));
    const metadata = frontmatter(skillContent);
    if (!metadata?.name || !metadata.description) failures.push(`${relative(root, skillFile)} must declare name and description.`);
    if (metadata?.name && metadata.name !== directory.name) failures.push(`${relative(root, skillFile)} name must match its directory.`);
    failures.push(...skillFrontmatterProblems(relative(root, skillFile), skillContent));
    failures.push(...skillStructureProblems(relative(root, skillFile), skillContent));
    failures.push(...brokenRelativeLinkProblems(relative(root, skillFile), skillContent, target => existsSync(join(dirname(skillFile), target))));
    const skillDirectory = join(corpus, 'skills', directory.name);
    const skillFiles = (await files(skillDirectory)).filter(path => path !== skillFile);
    authoringFindings.push(...assetReachabilityFindings(relative(root, skillFile), skillBody(skillContent), skillFiles.map(path => relative(skillDirectory, path).replaceAll('\\', '/'))));
    const referenceFiles = skillFiles.filter(path => path.endsWith('.md'));
    failures.push(...skillReferenceProblems(relative(root, skillFile), skillBody(skillContent), referenceFiles.map(path => relative(skillDirectory, path).replaceAll('\\', '/'))));
    for (const referenceFile of referenceFiles) {
        const referenceContent = await readFile(referenceFile, 'utf8');
        authoringFindings.push(...skillAuthoringFindings(relative(root, referenceFile), referenceContent));
        failures.push(...referenceContentsProblems(relative(root, referenceFile), referenceContent));
        failures.push(...brokenRelativeLinkProblems(relative(root, referenceFile), referenceContent, target => existsSync(join(dirname(referenceFile), target))));
        if (relative(skillDirectory, referenceFile).replaceAll('\\', '/').startsWith('references/')) {
            hygieneFindings.push(...skillHygieneFindings(relative(root, referenceFile), referenceContent));
        }
    }
}
for (const exception of assetExceptions) {
    if (!skillDirectories.some(entry => exception.file.startsWith(`.cratis/ai/skills/${entry.name}/`))) {
        authoringFindings.push({ file: exception.file, line: 1, rule: 'asset-reachability', matchedText: 'Remove the exception for an absent skill.' });
    }
}
const authoringReport = skillHygieneReport(authoringFindings);
failures.push(...skillAuthoringProblems(authoringFindings, skillAuthoringMode));
console.log(`Skill authoring (${skillAuthoringMode}): checked ${skillDirectories.length} skills and ${referencingFiles.flat().length} instructions; ${authoringReport.total} findings in ${authoringReport.perFile.length} files.`);
console.log(JSON.stringify({ skillAuthoring: { mode: skillAuthoringMode, ...authoringReport } }, null, 2));
const hygieneReport = skillHygieneReport(hygieneFindings);
failures.push(...skillHygieneProblems(hygieneFindings, skillHygieneMode));
console.log(`Skill hygiene (${skillHygieneMode}): ${hygieneReport.total} findings in ${hygieneReport.perFile.length} files.`);
console.log(JSON.stringify({ skillHygiene: { mode: skillHygieneMode, ...hygieneReport } }, null, 2));

for (const prompt of (await readdir(join(corpus, 'prompts'))).filter(name => name.endsWith('.md'))) {
    const path = join(corpus, 'prompts', prompt);
    const metadata = frontmatter(await readFile(path, 'utf8'));
    if (!prompt.endsWith('.prompt.md') || !metadata?.description) failures.push(`${relative(root, path)} must be a *.prompt.md file with a description.`);
}
for (const agent of (await readdir(join(corpus, 'agents'))).filter(name => name.endsWith('.md'))) {
    const path = join(corpus, 'agents', agent);
    const content = await readFile(path, 'utf8');
    const metadata = frontmatter(content);
    if (!metadata?.name || !metadata.description) failures.push(`${relative(root, path)} must declare name and description.`);
    // One canonical vocabulary, resolvable on every harness: Claude Code reads it natively, Copilot and Cursor
    // map or ignore it, the Pi extension normalizes it, and the OpenCode adapter is generated from it.
    const canonical = parseCanonicalAgent(agent, content);
    const unknown = canonical.tools.filter(tool => !(canonicalToolNames as readonly string[]).includes(tool));
    if (unknown.length > 0) failures.push(`${relative(root, path)} declares tools outside the canonical vocabulary (${unknown.join(', ')}); Claude Code would refuse to launch it and Pi would launch it unrestricted.`);
    const piError = toolsErrorFor(canonical.name, canonical.tools);
    if (piError) failures.push(`${relative(root, path)}: ${piError}`);
    if (canonical.readonly && canonical.tools.some(tool => tool === 'Edit' || tool === 'Write')) failures.push(`${relative(root, path)} is readonly but declares Edit/Write.`);
}
for (const stale of checkOpenCodeAgents(corpus)) failures.push(`OpenCode agent adapters are out of date: ${stale}`);
for (const stale of checkPiAgents(corpus)) failures.push(`Pi agent adapters are out of date: ${stale}`);
for (const stale of checkCopilotInstructions(corpus)) failures.push(`Copilot instruction adapters are out of date: ${stale}`);
for (const script of (await files(join(corpus, 'hooks', 'scripts'))).filter(path => path.endsWith('.sh'))) {
    const mode = (await stat(script)).mode;
    if ((mode & 0o111) === 0) failures.push(`${relative(root, script)} must be executable.`);
}

for (const scenarioPath of (await files(join(corpus, 'skills'))).filter(path => basename(path) === 'verification.json')) {
    const scenario = JSON.parse(await readFile(scenarioPath, 'utf8')) as Scenario;
    if (!scenario.skill || !scenario.input || !Array.isArray(scenario.assertions) || scenario.assertions.length === 0) {
        failures.push(`${relative(root, scenarioPath)} must define skill, input, and non-empty assertions.`);
        continue;
    }
    const skillPath = join(corpus, 'skills', scenario.skill, 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    for (const assertion of scenario.assertions) {
        // Compiler-backed assertions are checked together, with one version probe and bounded workers.
        if (assertion.kind === 'play-compiles') continue;
        let assertionContent: string | undefined = content;
        if (assertion.file !== undefined) {
            assertionContent = undefined;
            if (!skillAssertionFileProblem(assertion.file)) {
                const referencePath = join(corpus, 'skills', scenario.skill, assertion.file.replaceAll('\\', '/'));
                if (await exists(referencePath) && (await stat(referencePath)).isFile()) {
                    const skillDirectory = await realpath(join(corpus, 'skills', scenario.skill));
                    const target = relative(skillDirectory, await realpath(referencePath));
                    if (!skillAssertionFileProblem(target)) assertionContent = await readFile(referencePath, 'utf8');
                }
            }
        }
        failures.push(...skillContainsAssertionProblems(relative(root, scenarioPath), assertion, assertionContent));
    }
    scenarioResults.push({
        scenario: relative(root, scenarioPath),
        skill: scenario.skill,
        digest: createHash('sha256').update(content).digest('hex'),
    });
}
if (scenarioResults.length === 0) failures.push('At least one executable skill verification scenario is required.');

// Current dependency pins live only in the two central tables; every other skill file points at them.
const pinFiles = (await Promise.all([join(root, '.cratis', 'ai', 'skills'), join(root, 'Evaluations', 'skills')].map(files)))
    .flat().filter(path => /\.(md|json)$/.test(path) && !path.includes('node_modules'))
    .map(async path => ({ path: relative(root, path), content: await readFile(path, 'utf8') }));
const pinReport = pinRestatements(
    await Promise.all(pinFiles),
    [...scaffoldPins(await readFile(join(root, scaffoldTable), 'utf8')), ...bundlePins(await readFile(join(root, bundleTable), 'utf8'))],
    JSON.parse(await readFile(join(import.meta.dirname, 'pin-restatement-exceptions.json'), 'utf8')) as PinException[]);
failures.push(...pinReport.problems);
console.log(pinSummary(pinReport));

try {
    const contract = await verifyContract(root);
    failures.push(...contract.problems);
    console.log(contractSummary(contract));
    console.log(JSON.stringify({ screenplayContract: contract }, null, 2));
} catch (error) {
    console.error(`Screenplay contract could not run: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
}

const screenplay = await verifyPlayExamples(root);
failures.push(...screenplay.problems);
console.log(JSON.stringify({ screenplay }, null, 2));

if (failures.length > 0) {
    console.error(JSON.stringify({ passed: false, failures }, null, 2));
    process.exit(1);
}
console.log(JSON.stringify({ passed: true, skills: skillDirectories.length, profiles: profiles.length, evaluationSkills: skillEvaluations.skills, mcpServers: (mcpCatalogue as { servers: unknown[] }).servers.length, scenarios: scenarioResults }, null, 2));
