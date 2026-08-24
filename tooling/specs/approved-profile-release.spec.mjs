// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
    buildApprovedProfileReleasePlan,
    buildReleaseInstructions,
    buildReleaseSupportMatrix,
    generateApprovedProfileRelease,
} from "../generate-approved-profile-release.mjs";
import {
    generatePassiveProfileAdapters,
    passiveHarnesses,
} from "../passive-profile-adapters.mjs";

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function clone(value) {
    return structuredClone(value);
}

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-approved-release-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function repositoryInputs() {
    return {
        profileCatalog: readJson("distribution/profile-catalog.json"),
        targets: readJson("catalog/v2/targets.json").targets,
        sources: readJson("catalog/v2/sources.json").sources,
        sourceContracts: readJson("catalog/v2/source-contracts.json").contracts,
        authoringContracts: readJson("catalog/v2/authoring-contracts.json")
            .contracts,
        artifacts: readJson("catalog/v2/artifacts.json").artifacts,
    };
}

test("current release request catalogs materialize candidate and release modes", () => {
    const plan = buildApprovedProfileReleasePlan({
        profileId: "public-fundamentals",
        version: "0.1.0-preview.1",
        ...repositoryInputs(),
    });
    assert.equal(plan.state, "READY_FOR_BOT_MATERIALIZATION");
    assert.deepEqual(plan.blockers, []);
    withTemporaryDirectory((root) => {
        const candidate = generateApprovedProfileRelease({
            outputRoot: join(root, "candidate"),
            profileId: "public-fundamentals",
            version: "0.1.0-preview.1",
        });
        assert.equal(candidate.state, "APPROVED_PROFILE_RELEASE_CANDIDATE");
        assert.equal(candidate.publicationEligible, false);
        assert.equal(candidate.instructionsFile, "release-instructions.md");
        assert.equal(candidate.supportMatrixFile, "support-matrix.json");
        const candidateSupport = readJson(
            join(root, "candidate/support-matrix.json"),
        );
        assert.equal(candidateSupport.profileId, "public-fundamentals");
        assert(
            candidateSupport.hosts.every((host) => host.hostTested === false),
        );
        assert.match(
            readFileSync(
                join(root, "candidate/release-instructions.md"),
                "utf8",
            ),
            /pi install -l npm:@cratis\/ai-fundamentals@0\.1\.0-preview\.1/,
        );
        assert.equal(
            readJson(join(root, "candidate/provenance.json"))
                .publicationEligible,
            false,
        );
        const release = generateApprovedProfileRelease({
            outputRoot: join(root, "release"),
            profileId: "public-fundamentals",
            version: "0.1.0-preview.1",
            releaseMode: true,
        });
        assert.equal(release.state, "APPROVED_PROFILE_RELEASE");
        assert.equal(release.publicationEligible, true);
        assert.equal(release.promotionEligible, false);
        assert.equal(
            readJson(join(root, "release/provenance.json"))
                .publicationEligible,
            true,
        );
    });
});

test("approved plan requires every authority security and evidence gate", () => {
    const inputs = clone(repositoryInputs());
    const profile = inputs.profileCatalog.publicProfiles.find(
        (candidate) => candidate.id === "public-fundamentals",
    );
    profile.state = "approved";
    const target = inputs.targets.find(
        (candidate) => candidate.id === "cratis-fundamentals-concept",
    );
    target.approval = {
        state: "approved",
        sourceRevision: "b53caa555b9a3f05ba1462b86202fe3ccb8a9470",
        contentDigest:
            "9e537c48a95c414709008c69ebfb616354d60992578ddd9da3d7dc7308c42caa",
        reviewer: "fundamentals-owner",
        approvedOn: "2026-08-23",
        securityEvidenceId: "security-evidence",
        behaviorEvidenceId: "behavior-evidence",
        portabilityEvidenceId: "portability-evidence",
        evidenceIds: ["approval-evidence"],
    };
    target.includeInRuntime = true;
    target.lifecycle = "approved";
    target.capabilityKind = "journey";
    target.invocation = "both";
    target.trust.assessmentState = "assessed";
    target.dependencyClassificationState = "classified";
    target.sourceContractState = "classified";
    target.authoringContractState = "classified";
    for (const dimension of [
        target.architectures,
        target.personas,
        target.surfaces,
        target.repositoryProfiles,
    ])
        dimension.state = "applicable";
    target.security = {
        ...target.security,
        disposition: "accepted",
        evidenceIds: ["security-evidence"],
    };
    for (const evaluation of Object.values(target.evaluations)) {
        evaluation.status = "passing";
        evaluation.evidenceIds = ["behavior-evidence"];
    }
    target.sourceContractIds = ["verified-fundamentals-source"];
    target.authoringContractIds = ["cratis-skill-clean-room-v1"];
    inputs.sourceContracts.push({
        id: "verified-fundamentals-source",
        verificationState: "verified",
        distributionInputAllowed: true,
    });
    const artifact = inputs.artifacts.find(
        (candidate) => candidate.id === "planned-passive-public-release",
    );
    artifact.materializationAllowed = true;
    artifact.runtimeEligible = true;
    const plan = buildApprovedProfileReleasePlan({
        profileId: profile.id,
        version: "1.0.0-preview.1+build.7",
        ...inputs,
    });
    assert.equal(plan.state, "READY_FOR_BOT_MATERIALIZATION");
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(plan.targetIds, ["cratis-fundamentals-concept"]);
    assert.equal(plan.packageName, "@cratis/ai-fundamentals");
    assert.equal(plan.displayName, "Cratis Fundamentals");
    assert.equal(
        plan.description,
        "Strongly typed Cratis Fundamentals concepts and Chronicle event-source identities for C# projects.",
    );
    assert.equal(plan.publicationEligible, false);
    assert.equal(plan.promotionEligible, false);
    const support = buildReleaseSupportMatrix(plan, passiveHarnesses);
    assert.equal(support.hosts.length, passiveHarnesses.length);
    assert(
        support.hosts.every(
            (host) =>
                host.generated === true &&
                host.staticallyValidated === true &&
                host.hostTested === false &&
                host.support === "generated-not-yet-supported-by-this-release",
        ),
    );
    assert.equal(
        support.hosts.find((host) => host.harness === "pi").releaseCanary,
        "required-before-publication",
    );
    const instructions = buildReleaseInstructions(plan, passiveHarnesses);
    assert.match(
        instructions,
        /pi install -l npm:@cratis\/ai-fundamentals@1\.0\.0-preview\.1\+build\.7/,
    );
    assert.match(instructions, /sha256sum -c SHA256SUMS/);
    assert.match(instructions, /support-matrix\.json/);
    assert.match(
        instructions,
        /cratis-ai-public-fundamentals-1\.0\.0-preview\.1\+build\.7-agent-plugin\.tar\.gz/,
    );

    const source = inputs.sources.find(
        (candidate) => candidate.id === "add-concept",
    );
    target.approval.contentDigest = "0".repeat(64);
    assert(
        buildApprovedProfileReleasePlan({
            profileId: profile.id,
            version: "1.0.0",
            ...inputs,
        }).blockers.includes(
            "cratis-fundamentals-concept:APPROVAL_SOURCE_BINDING_MISMATCH",
        ),
    );
    target.approval.contentDigest = source.contentDigest;
    source.audience = "cratis-engineering";
    assert(
        buildApprovedProfileReleasePlan({
            profileId: profile.id,
            version: "1.0.0",
            ...inputs,
        }).blockers.includes(
            "cratis-fundamentals-concept:SOURCE_AUDIENCE_MISMATCH",
        ),
    );
    source.audience = "public";
    target.evaluations = {};
    target.sourceContractIds = [];
    target.authoringContractIds = [];
    target.approval.evidenceIds = [];
    const incompletePlan = buildApprovedProfileReleasePlan({
        profileId: profile.id,
        version: "1.0.0",
        ...inputs,
    });
    for (const blocker of [
        "cratis-fundamentals-concept:APPROVAL_EVIDENCE_INCOMPLETE",
        "cratis-fundamentals-concept:EVALUATION_SET_INCOMPLETE",
        "cratis-fundamentals-concept:SOURCE_CONTRACTS_MISSING",
        "cratis-fundamentals-concept:AUTHORING_CONTRACTS_MISSING",
    ])
        assert(incompletePlan.blockers.includes(blocker), blocker);
});

test("passive adapter materializer rejects unsafe or mismatched skill input", () => {
    withTemporaryDirectory((root) => {
        const base = {
            version: "1.0.0",
            profileId: "public-example",
            packageName: "@cratis/ai-example",
            description: "Example",
        };
        assert.throws(
            () =>
                generatePassiveProfileAdapters({
                    ...base,
                    outputRoot: join(root, "traversal"),
                    skills: [
                        {
                            name: "cratis-example",
                            files: [
                                {
                                    path: "SKILL.md",
                                    content: Buffer.from(
                                        "---\nname: different-name\ndescription: Wrong.\n---\n",
                                    ),
                                },
                                {
                                    path: "references/../escape.md",
                                    content: Buffer.from("escape\n"),
                                },
                            ],
                        },
                    ],
                }),
            /invalid|does not match/,
        );
        assert.equal(existsSync(join(root, "traversal")), false);
        const validHeader =
            "---\nname: cratis-example\ndescription: Example.\n---\n";
        assert.throws(
            () =>
                generatePassiveProfileAdapters({
                    ...base,
                    outputRoot: join(root, "case-collision"),
                    skills: [
                        {
                            name: "cratis-example",
                            files: [
                                {
                                    path: "SKILL.md",
                                    content: Buffer.from(validHeader),
                                },
                                {
                                    path: "references/Guide.md",
                                    content: Buffer.from("Guide\n"),
                                },
                                {
                                    path: "references/guide.md",
                                    content: Buffer.from("guide\n"),
                                },
                            ],
                        },
                    ],
                }),
            /invalid/,
        );
        assert.throws(
            () =>
                generatePassiveProfileAdapters({
                    ...base,
                    outputRoot: join(root, "malformed-frontmatter"),
                    skills: [
                        {
                            name: "cratis-example",
                            files: [
                                {
                                    path: "SKILL.md",
                                    content: Buffer.from(
                                        "---\ndescription: Missing name.\n---\n\nname: cratis-example\n",
                                    ),
                                },
                            ],
                        },
                    ],
                }),
            /frontmatter name or description is invalid/,
        );
    });
});

test("release provenance binds generators and checksums the final manifest", () => {
    const generator = readFileSync(
        "tooling/generate-approved-profile-release.mjs",
        "utf8",
    );
    assert(generator.includes("generatorDigest"));
    assert(generator.includes('"tooling/profile-presentation.mjs"'));
    assert(generator.includes("testedHostVersions"));
    assert(generator.includes('state: "pending-canary"'));
    assert(
        generator.indexOf(
            'writeJson(join(root, "release-manifest.json"), releaseManifest)',
        ) < generator.indexOf('join(root, "SHA256SUMS")'),
    );
});

test("passive adapter materializer emits one install root per harness", () => {
    withTemporaryDirectory((root) => {
        const outputRoot = join(root, "release");
        const skillBytes = Buffer.from(
            "---\nname: cratis-example\ndescription: Example passive skill.\n---\n\n# Example\n",
        );
        const manifest = generatePassiveProfileAdapters({
            outputRoot,
            version: "1.2.3-preview.1",
            profileId: "public-example",
            packageName: "@cratis/ai-example",
            description: "Cratis example profile",
            skills: [
                {
                    name: "cratis-example",
                    files: [
                        { path: "SKILL.md", content: skillBytes },
                        { path: "LICENSE", content: Buffer.from("MIT\n") },
                    ],
                },
            ],
        });
        assert.deepEqual(manifest.harnesses, passiveHarnesses);
        for (const harness of passiveHarnesses)
            assert.equal(manifest.roots[harness], `harnesses/${harness}`);
        const portablePlugin = readJson(
            join(outputRoot, "harnesses/agent-plugin/plugin.json"),
        );
        const copilotPlugin = readJson(
            join(
                outputRoot,
                "harnesses/copilot/plugins/public-example/plugin.json",
            ),
        );
        const cursorPlugin = readJson(
            join(
                outputRoot,
                "harnesses/cursor/plugins/public-example/plugin.json",
            ),
        );
        const kiroPlugin = readJson(
            join(outputRoot, "harnesses/kiro/plugin.json"),
        );
        assert.deepEqual(copilotPlugin, portablePlugin);
        assert.deepEqual(cursorPlugin, portablePlugin);
        assert.deepEqual(kiroPlugin, portablePlugin);
        assert.equal(
            portablePlugin.$schema,
            "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        );
        assert.equal(portablePlugin.repository, "https://github.com/Cratis/AI");
        assert.equal(portablePlugin.homepage, "https://cratis.io/ai");
        assert.deepEqual(portablePlugin.keywords, ["cratis", "agent-skills"]);
        assert.deepEqual(Object.keys(portablePlugin).sort(), [
            "$schema",
            "author",
            "description",
            "homepage",
            "keywords",
            "license",
            "name",
            "repository",
            "version",
        ]);
        assert.equal(portablePlugin.skills, undefined);
        assert.equal(portablePlugin.hooks, undefined);
        assert.equal(portablePlugin.mcpServers, undefined);
        const piPackage = readJson(
            join(outputRoot, "harnesses/pi/package.json"),
        );
        assert.equal(piPackage.name, "@cratis/ai-example");
        assert.equal(piPackage.version, "1.2.3-preview.1");
        assert.equal(piPackage.private, false);
        assert.deepEqual(piPackage.repository, {
            type: "git",
            url: "https://github.com/Cratis/AI",
        });
        assert.equal(piPackage.homepage, "https://cratis.io/ai");
        assert.deepEqual(piPackage.pi, { skills: ["./skills"] });
        assert.equal(piPackage.scripts, undefined);
        assert.equal(piPackage.dependencies, undefined);
        assert.equal(
            readFileSync(
                join(
                    outputRoot,
                    "harnesses/grok/.grok/skills/cratis-example/SKILL.md",
                ),
            ).equals(skillBytes),
            true,
        );
        assert.equal(
            readFileSync(
                join(
                    outputRoot,
                    "harnesses/deepseek/.dsh/skills/cratis-example/SKILL.md",
                ),
            ).equals(skillBytes),
            true,
        );
    });
});
