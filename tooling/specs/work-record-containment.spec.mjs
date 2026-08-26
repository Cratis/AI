// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
    return readFileSync(path, "utf8");
}

const general = read(".ai/rules/general.md");
const agents = read("AGENTS.md");
const claude = read(".claude/CLAUDE.md");
const pullRequests = read(".ai/rules/pull-requests.md");
const shipSkill = read(".ai/skills/ship-changes/SKILL.md");
const shipPrompt = read(".ai/prompts/ship-changes.prompt.md");
const shipEvals = read(".ai/skills/ship-changes/evals/evals.json");
const releaseWorkflow = read(".github/workflows/release-approved-ai-profiles.yml");
const claudeWorkflow = read(".ai/workflows/claude.yml");
const localWorkArtifacts = read(".ai/rules/local-work-artifacts.md");
const gitignore = read(".gitignore");

const mutatingIssueCommand = /\bgh\s+issue\s+(?:create|comment|edit|close|reopen|delete|pin|unpin|lock|unlock|transfer|develop)\b/;

function assertNoIssueMutationInstruction(path, content) {
    assert.equal(mutatingIssueCommand.test(content), false, path);
    assert.doesNotMatch(content, /issue-mutating MCP\/API tools?\s+(?:now|directly|automatically)/i, path);
}

test("repository intake is transient and no-effect in every always-on adapter", () => {
    assert.equal(agents, general);
    assert.equal(claude, general);
    for (const content of [general, agents, claude]) {
        assert.match(content, /## New Repository Strategy Intake/);
        assert.match(content, /transient,\s*no-effect Strategy intake proposal/);
        assert.match(content, /Do not create, comment on, assign, mention/);
        assert.match(content, /Repository\s+creation does not require an issue URL/);
        assert.doesNotMatch(content, /create a linked\s+issue in `Cratis\/Strategy`/);
    }
});

test("shared shipping guidance prepares issue dispositions without mutating issues", () => {
    for (const [path, content] of [
        [".ai/rules/pull-requests.md", pullRequests],
        [".ai/skills/ship-changes/SKILL.md", shipSkill],
        [".ai/prompts/ship-changes.prompt.md", shipPrompt],
        [".ai/skills/ship-changes/evals/evals.json", shipEvals],
    ]) {
        assertNoIssueMutationInstruction(path, content);
    }
    assert.match(shipSkill, /Issue closure, comments, assignment, mentions, labels, and relationship changes\s+are separate notification\/effect operations/);
    assert.match(shipSkill, /Do not run `gh issue` mutation commands/);
    assert.match(shipSkill, /An open related issue does not make the code shipment\s+incomplete/);
    assert.match(shipEvals, /Prepares a no-effect post-merge disposition/);
    assert.match(shipEvals, /Does not comment on or close the issue from the shared skill/);
});

test("release workflows do not use issue-write permission or issue comments", () => {
    assert.doesNotMatch(releaseWorkflow, /issues:\s*write/);
    assert.doesNotMatch(releaseWorkflow, /\bgh\s+issue\s+comment\b/);
    assert.match(releaseWorkflow, /GITHUB_STEP_SUMMARY/);
});

test("the bundled Claude workflow is inert and read-only", () => {
    assert.match(claudeWorkflow, /workflow_dispatch:/);
    assert.match(claudeWorkflow, /contents:\s*read/);
    assert.doesNotMatch(claudeWorkflow, /issues:\s*write/);
    assert.doesNotMatch(claudeWorkflow, /pull-requests:\s*write/);
    assert.doesNotMatch(claudeWorkflow, /anthropics\/claude-code-action/);
});

test("historical AI work records are absent and local work remains untracked", () => {
    assert.equal(
        existsSync("AI-REPOSITORY-REDESIGN-AUTONOMOUS-PROMPT.md"),
        false,
    );
    assert.match(localWorkArtifacts, /work records, not documentation/);
    assert.match(localWorkArtifacts, /inside \*\*`\.ai-work\/`\*\*/);
    assert.match(localWorkArtifacts, /must stay untracked/);
    assert.match(gitignore, /^\.ai-work\/$/m);
});
