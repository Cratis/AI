#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { compareOrdinal } from "./catalog-ordering.mjs";
import { loadPassiveCandidateAuthority } from "./package-passive-candidate-assets.mjs";
import { generatePassiveProfileAdapters } from "./passive-profile-adapters.mjs";

const defaultRepositoryRoot = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);
const profileId = "public-cratis-ai";
const packageName = "@cratis/ai";
const description =
    "Cratis AI skills for event-sourced and CQRS application development";
const repositoryUrl = "https://github.com/Cratis/AI.Distribution";
const homepage = "https://cratis.io/ai";
const selectedHarnesses = Object.freeze([
    "agent-skills",
    "agent-plugin",
    "claude",
    "codex",
    "copilot",
    "cursor",
    "gemini",
    "kiro",
    "pi",
]);

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function walkFiles(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        const relativePath = relative(root, path).replaceAll("\\", "/");
        const stat = lstatSync(path);
        if (stat.isSymbolicLink())
            throw new Error(`Marketplace source contains a symlink: ${relativePath}`);
        if (stat.isDirectory()) return walkFiles(root, path);
        if (!stat.isFile())
            throw new Error(`Marketplace source contains a special file: ${relativePath}`);
        return [relativePath];
    });
}

function mergeRoot(sourceRoot, outputRoot, origins, harness) {
    for (const path of walkFiles(sourceRoot).sort(compareOrdinal)) {
        const source = readFileSync(join(sourceRoot, path));
        const destination = join(outputRoot, path);
        if (existsSync(destination)) {
            if (!readFileSync(destination).equals(source))
                throw new Error(
                    `Marketplace projection collision differs: ${path} (${origins.get(path)} and ${harness})`,
                );
            origins.set(path, `${origins.get(path)},${harness}`);
            continue;
        }
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, source, { flag: "wx" });
        origins.set(path, harness);
    }
}

function marketplaceReadme(version) {
    return `# Cratis AI\n\n` +
        `Passive skills for building event-sourced and CQRS applications with Cratis.\n\n` +
        `## Install\n\n` +
        `### Claude Code\n\n` +
        `\`\`\`text\n/plugin marketplace add Cratis/AI.Distribution\n/plugin install ${profileId}@cratis\n\`\`\`\n\n` +
        `### OpenAI Codex CLI\n\n` +
        `\`\`\`bash\ncodex plugin marketplace add Cratis/AI.Distribution --ref v${version}\ncodex plugin add ${profileId}@cratis\n\`\`\`\n\n` +
        `### GitHub Copilot CLI\n\n` +
        `\`\`\`bash\ncopilot plugin marketplace add Cratis/AI.Distribution\ncopilot plugin install ${profileId}@cratis\n\`\`\`\n\n` +
        `### Gemini CLI\n\n` +
        `\`\`\`bash\ngemini extensions install https://github.com/Cratis/AI.Distribution --ref v${version}\n\`\`\`\n\n` +
        `### Kiro\n\n` +
        `Choose **Add Custom Power**, then import \`${repositoryUrl}\`.\n\n` +
        `### Pi\n\n` +
        `\`\`\`bash\npi install git:github.com/Cratis/AI.Distribution@v${version}\n\`\`\`\n\n` +
        `### Generic Agent Skills and Agent Plugins\n\n` +
        `Use the root \`skills/\` directory or root \`plugin.json\` from the tagged repository.\n\n` +
        `## Status\n\n` +
        `This is an unsupported \`0.x\` evaluation distribution. Publication, static validation, ` +
        `and package lifecycle checks do not grant a support claim. The source repository's ` +
        `blocked and repository-only exclusions remain excluded.\n`;
}

function openAiSubmission(version) {
    return {
        schemaVersion: "1.0.0",
        submissionType: "skills-only",
        pluginRoot: `plugins/${profileId}`,
        name: "Cratis AI",
        shortDescription:
            "Cratis skills for event-sourced and CQRS application development.",
        longDescription:
            "Passive guidance for Cratis Fundamentals, Arc, Chronicle, Components, React, specifications, documentation, and application workflows. The plugin contains instructions and references only; it has no MCP server, scripts, dependencies, credentials, or network behavior.",
        category: "Developer Tools",
        website: homepage,
        supportUrl: "https://github.com/Cratis/AI/issues",
        sourceRepository: repositoryUrl,
        version,
        releaseNotes: "Initial unsupported 0.x public evaluation release.",
        portalReadiness: "OWNER_IDENTITY_AND_LISTING_ASSETS_REQUIRED",
        requiredOwnerInputs: [
            "verified OpenAI developer identity",
            "logo",
            "privacy policy URL",
            "terms URL",
            "country availability",
            "policy attestations",
        ],
        supportGranted: false,
        positiveTests: [
            {
                prompt: "Create a strongly typed author name concept and a Guid-backed Chronicle event-source identity.",
                expected: "Uses ConceptAs<string> and EventSourceId<Guid> with Cratis conventions.",
            },
            {
                prompt: "Add a model-bound Arc command that appends a past-tense Chronicle event.",
                expected: "Uses a model-bound command, validator boundaries, and an immutable event.",
            },
            {
                prompt: "Create a Chronicle read model and projection for a list of registered authors.",
                expected: "Uses a focused read model, AutoMap-first projection guidance, and a model-bound query.",
            },
            {
                prompt: "Build a React page that consumes an Arc-generated observable query.",
                expected: "Uses generated proxies, MVVM conventions, and Cratis Components.",
            },
            {
                prompt: "Write behavior specs for a Cratis command and its appended event.",
                expected: "Uses the appropriate in-process scenario and BDD naming conventions.",
            },
        ],
        negativeTests: [
            {
                prompt: "Write a generic sorting algorithm in Rust.",
                expected: "Does not apply Cratis-specific application guidance.",
                rationale: "The request is unrelated to Cratis.",
            },
            {
                prompt: "Call an undocumented Studio MCP operation to delete production data.",
                expected: "Refuses to invent or invoke an unadmitted operation.",
                rationale: "No executable Studio MCP operation is included.",
            },
            {
                prompt: "Implement a Chronicle Java client from assumptions about the Kotlin client.",
                expected: "Does not synthesize unsupported Java client authority.",
                rationale: "The public profile records an authority gap for Java.",
            },
        ],
    };
}

function cursorSubmission(version) {
    return {
        schemaVersion: "1.0.0",
        name: profileId,
        displayName: "Cratis AI",
        repository: repositoryUrl,
        pluginManifest: "plugin.json",
        marketplaceManifest: ".cursor-plugin/marketplace.json",
        category: "Developer Tools",
        version,
        description,
        supportUrl: "https://github.com/Cratis/AI/issues",
        localValidationRequired: true,
        supportGranted: false,
    };
}

function canonicalFileRecords(authority, outputRoot) {
    return authority.skills.flatMap((skill) =>
        skill.files.map((file) => {
            const canonicalPath = `skills/${skill.name}/${file.path}`;
            const pluginPath = `plugins/${profileId}/${canonicalPath}`;
            const content = readFileSync(join(outputRoot, canonicalPath));
            if (!readFileSync(join(outputRoot, pluginPath)).equals(content))
                throw new Error(`Marketplace plugin byte parity failed: ${canonicalPath}`);
            return {
                path: canonicalPath,
                size: content.length,
                sha256: sha256(content),
                copies: [canonicalPath, pluginPath],
            };
        }),
    ).sort((left, right) => compareOrdinal(left.path, right.path));
}

export function generatePublicMarketplaceDistribution({
    repositoryRoot = defaultRepositoryRoot,
    outputRoot,
    version,
} = {}) {
    if (!outputRoot || !/^0\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/.test(version ?? ""))
        throw new Error("outputRoot and an exact 0.x.y version are required");
    const root = resolve(outputRoot);
    if (existsSync(root)) throw new Error(`Marketplace output already exists: ${root}`);
    const temporaryRoot = mkdtempSync(join(tmpdir(), "cratis-marketplace-"));
    mkdirSync(root, { recursive: false });
    try {
        const authority = loadPassiveCandidateAuthority(
            repositoryRoot,
            "candidate-passive-public-package",
        );
        if (authority.targets.length !== 34)
            throw new Error("Public marketplace target inventory changed");
        const adaptersRoot = join(temporaryRoot, "adapters");
        const adapters = generatePassiveProfileAdapters({
            outputRoot: adaptersRoot,
            version,
            profileId,
            packageName,
            description,
            skills: authority.skills,
            codexInstallationPolicy: "AVAILABLE",
            piPrivate: false,
            homepage,
            repositoryUrl,
        });
        const origins = new Map();
        for (const harness of selectedHarnesses) {
            const harnessRoot = adapters.roots[harness];
            if (!harnessRoot) throw new Error(`Missing marketplace harness: ${harness}`);
            mergeRoot(join(adaptersRoot, harnessRoot), root, origins, harness);
        }
        writeFileSync(join(root, "LICENSE"), readFileSync(join(repositoryRoot, "LICENSE")), {
            flag: "wx",
        });
        writeFileSync(join(root, "README.md"), marketplaceReadme(version), {
            flag: "wx",
        });
        mkdirSync(join(root, "submissions"), { recursive: false });
        writeJson(join(root, "submissions/openai.json"), openAiSubmission(version));
        writeJson(join(root, "submissions/cursor.json"), cursorSubmission(version));

        const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: repositoryRoot,
            encoding: "utf8",
        }).trim();
        const canonicalFiles = canonicalFileRecords(authority, root);
        const provenance = {
            schemaVersion: "1.0.0",
            state: "PUBLIC_EVALUATION_MARKETPLACE_NOT_SUPPORT",
            canonicalRepository: "Cratis/AI",
            distributionRepository: "Cratis/AI.Distribution",
            sourceCommit,
            generator: "tooling/generate-public-marketplace-distribution.mjs",
            version,
            profileId,
            selectedHarnesses,
            targetIds: authority.targets.map((target) => target.id).sort(compareOrdinal),
            targetExclusions: authority.artifact.targetExclusions ?? [],
            repositoryOnlySkillExclusions: authority.repositoryOnlySkills,
            nativeComponentsIncluded: false,
            nativeComponentsReason:
                "Native rules and instructions retain separate semantic artifacts and are not repackaged as skills.",
            canonicalFiles,
            installationAvailable: true,
            installationSupported: false,
            behaviorSupported: false,
            supportGranted: false,
            promotionEligible: false,
        };
        writeJson(join(root, "provenance.json"), provenance);
        const releaseSchemaPath =
            "distribution/public-marketplace-release.schema.json";
        const release = {
            schemaVersion: "1.0.0",
            schemaPath: releaseSchemaPath,
            schemaSha256: sha256(
                readFileSync(join(repositoryRoot, releaseSchemaPath)),
            ),
            state: "PUBLIC_EVALUATION_MARKETPLACE",
            version,
            profileId,
            packageName,
            description,
            sourceCommit,
            targetCount: authority.targets.length,
            skillCount: authority.skills.length,
            selectedHarnesses,
            marketplaceChannels: [
                "agent-skills",
                "agent-plugin",
                "claude-code",
                "codex-openai-submission",
                "github-copilot",
                "cursor-submission",
                "gemini-cli",
                "kiro",
                "pi-git-package",
            ],
            installationAvailable: true,
            installationSupported: false,
            supportGranted: false,
            promotionEligible: false,
        };
        writeJson(join(root, "marketplace-release.json"), release);

        const checksumPaths = walkFiles(root).sort(compareOrdinal);
        writeFileSync(
            join(root, "SHA256SUMS"),
            `${checksumPaths
                .map((path) => `${sha256(readFileSync(join(root, path)))}  ${path}`)
                .join("\n")}\n`,
            { flag: "wx" },
        );
        const manifestPaths = walkFiles(root).sort(compareOrdinal);
        const manifest = {
            schemaVersion: "1.0.0",
            state: "PUBLIC_EVALUATION_MARKETPLACE",
            version,
            profileId,
            generatedTargets: selectedHarnesses,
            files: manifestPaths.map((path) => {
                const content = readFileSync(join(root, path));
                return { path, sha256: sha256(content), size: content.length };
            }),
            publicationEligible: true,
            installationSupported: false,
            supportGranted: false,
            promotionEligible: false,
        };
        writeJson(join(root, "distribution-manifest.json"), manifest);
        return { manifest, provenance, release };
    } catch (error) {
        rmSync(root, { recursive: true, force: true });
        throw error;
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

function main() {
    const [outputRoot, version] = process.argv.slice(2);
    try {
        const result = generatePublicMarketplaceDistribution({ outputRoot, version });
        process.stdout.write(
            `Generated ${result.release.profileId}@${result.release.version} for ${result.release.marketplaceChannels.length} marketplace channels.\n`,
        );
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Marketplace generation failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
