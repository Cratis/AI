// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
    assertSafeContent,
    validatePayloadPath,
} from "./public-artifact-materializer.mjs";

export const passiveHarnesses = [
    "agent-skills",
    "agent-plugin",
    "claude",
    "codex",
    "copilot",
    "cursor",
    "deepseek",
    "gemini",
    "grok",
    "junie",
    "kiro",
    "pi",
];

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function writeExclusive(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, { flag: "wx" });
}

function writeJson(path, value) {
    writeExclusive(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function createAgentPluginManifest({ name, version, description }) {
    return {
        $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        name,
        version,
        description,
        author: {
            name: "Cratis",
            url: "https://cratis.io",
        },
        homepage: "https://cratis.io/ai",
        repository: "https://github.com/Cratis/AI",
        license: "MIT",
        keywords: ["cratis", "agent-skills"],
    };
}

function walkFiles(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const path = join(current, entry.name);
        if (entry.isDirectory()) return walkFiles(root, path);
        if (!entry.isFile())
            throw new Error(`Profile adapter contains a special file: ${path}`);
        return [relative(root, path).replaceAll("\\", "/")];
    });
}

export function readSkillFrontmatter(content, skillName) {
    const text = content.toString("utf8");
    if (!text.startsWith("---\n"))
        throw new Error(`Profile skill frontmatter is missing: ${skillName}`);
    const closing = text.indexOf("\n---\n", 4);
    if (closing < 0)
        throw new Error(`Profile skill frontmatter is unclosed: ${skillName}`);
    const properties = new Map();
    for (const line of text.slice(4, closing).split("\n")) {
        if (!line.trim()) continue;
        const match = /^([A-Za-z][A-Za-z0-9-]*):\s*(\S.*)$/.exec(line);
        if (!match || properties.has(match[1]))
            throw new Error(
                `Profile skill frontmatter is invalid: ${skillName}`,
            );
        properties.set(match[1], match[2]);
    }
    if (properties.get("name") !== skillName || !properties.get("description"))
        throw new Error(
            `Profile skill frontmatter name or description is invalid: ${skillName}`,
        );
    return properties;
}

function copySkills(skills, root) {
    for (const skill of skills)
        for (const file of skill.files)
            writeExclusive(
                join(root, "skills", skill.name, file.path),
                file.content,
            );
}

function assertInputs({ version, profileId, packageName, description, skills }) {
    if (
        !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
            version,
        )
    )
        throw new Error("Profile release version must be exact SemVer");
    if (!/^(?:public|engineering)-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileId))
        throw new Error("Profile id is invalid");
    if (!/^@cratis\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packageName))
        throw new Error("Profile package name is invalid");
    if (
        typeof description !== "string" ||
        description.length === 0 ||
        description.length > 1024
    )
        throw new Error("Profile package description is invalid");
    if (!Array.isArray(skills) || skills.length === 0)
        throw new Error("Profile release requires at least one skill");
    const names = new Set();
    for (const skill of skills) {
        if (
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) ||
            names.has(skill.name) ||
            !Array.isArray(skill.files) ||
            !skill.files.some((file) => file.path === "SKILL.md")
        )
            throw new Error(`Profile skill input is invalid: ${skill.name}`);
        names.add(skill.name);
        const filePaths = new Set();
        const collisionKeys = new Set();
        for (const file of skill.files) {
            if (
                !/^(?:SKILL\.md|LICENSE[^/]*|references\/[A-Za-z0-9._/-]+|assets\/[A-Za-z0-9._/-]+)$/.test(
                    file.path,
                ) ||
                file.path.split("/").includes("..") ||
                !Buffer.isBuffer(file.content) ||
                filePaths.has(file.path) ||
                collisionKeys.has(file.path.normalize("NFC").toLowerCase())
            )
                throw new Error(
                    `Profile skill file is invalid: ${skill.name}/${file.path}`,
                );
            filePaths.add(file.path);
            collisionKeys.add(file.path.normalize("NFC").toLowerCase());
            const payloadPath = `skills/${skill.name}/${file.path}`;
            validatePayloadPath(payloadPath);
            assertSafeContent(payloadPath, file.content);
        }
        readSkillFrontmatter(
            skill.files.find((file) => file.path === "SKILL.md").content,
            skill.name,
        );
    }
}

export function generatePassiveProfileAdapters({
    outputRoot,
    version,
    profileId,
    packageName,
    description,
    skills,
    codexInstallationPolicy = "AVAILABLE",
    piPrivate = false,
}) {
    assertInputs({ version, profileId, packageName, description, skills });
    if (
        !["AVAILABLE", "INSTALLED_BY_DEFAULT", "NOT_AVAILABLE"].includes(
            codexInstallationPolicy,
        ) ||
        typeof piPrivate !== "boolean"
    )
        throw new Error("Profile adapter publication policy is invalid");
    const root = resolve(outputRoot);
    if (existsSync(root))
        throw new Error(`Profile adapter output must not exist: ${root}`);
    mkdirSync(root, { recursive: false });
    const harnessRoot = (harness) => join(root, "harnesses", harness);

    copySkills(skills, harnessRoot("agent-skills"));

    const agentPluginRoot = harnessRoot("agent-plugin");
    copySkills(skills, agentPluginRoot);
    writeJson(
        join(agentPluginRoot, "plugin.json"),
        createAgentPluginManifest({
            name: profileId,
            version,
            description,
        }),
    );

    const claudeRoot = harnessRoot("claude");
    copySkills(skills, join(claudeRoot, `plugins/${profileId}`));
    writeJson(join(claudeRoot, ".claude-plugin/marketplace.json"), {
        name: "cratis",
        owner: { name: "Cratis" },
        metadata: { description, version },
        plugins: [
            {
                name: profileId,
                description,
                version,
                source: `./plugins/${profileId}`,
                strict: true,
            },
        ],
    });
    writeJson(
        join(claudeRoot, `plugins/${profileId}/.claude-plugin/plugin.json`),
        {
            name: profileId,
            version,
            description,
            author: { name: "Cratis" },
        },
    );

    const codexRoot = harnessRoot("codex");
    copySkills(skills, join(codexRoot, `plugins/${profileId}`));
    writeJson(join(codexRoot, ".agents/plugins/marketplace.json"), {
        name: "cratis",
        interface: { displayName: "Cratis" },
        plugins: [
            {
                name: profileId,
                source: {
                    source: "local",
                    path: `./plugins/${profileId}`,
                },
                policy: {
                    installation: codexInstallationPolicy,
                    ...(codexInstallationPolicy === "NOT_AVAILABLE"
                        ? {}
                        : { authentication: "ON_INSTALL" }),
                },
                category: "Developer Tools",
            },
        ],
    });
    writeJson(
        join(codexRoot, `plugins/${profileId}/.codex-plugin/plugin.json`),
        { name: profileId, version, description, skills: "./skills/" },
    );

    const copilotRoot = harnessRoot("copilot");
    copySkills(skills, join(copilotRoot, `plugins/${profileId}`));
    writeJson(join(copilotRoot, ".github/plugin/marketplace.json"), {
        name: "cratis",
        owner: { name: "Cratis" },
        metadata: { description, version },
        plugins: [
            {
                name: profileId,
                description,
                version,
                source: `./plugins/${profileId}`,
                strict: true,
            },
        ],
    });
    writeJson(
        join(copilotRoot, `plugins/${profileId}/plugin.json`),
        createAgentPluginManifest({ name: profileId, version, description }),
    );

    const cursorRoot = harnessRoot("cursor");
    copySkills(skills, join(cursorRoot, `plugins/${profileId}`));
    writeJson(join(cursorRoot, ".cursor-plugin/marketplace.json"), {
        name: "cratis",
        owner: { name: "Cratis" },
        metadata: { description, version },
        plugins: [
            {
                name: profileId,
                description,
                version,
                source: `./plugins/${profileId}`,
            },
        ],
    });
    writeJson(
        join(cursorRoot, `plugins/${profileId}/plugin.json`),
        createAgentPluginManifest({ name: profileId, version, description }),
    );

    const directRoots = {
        deepseek: ".dsh",
        gemini: ".",
        grok: ".grok",
        kiro: ".",
    };
    for (const [harness, destination] of Object.entries(directRoots))
        copySkills(skills, join(harnessRoot(harness), destination));
    writeJson(join(harnessRoot("gemini"), "gemini-extension.json"), {
        name: profileId,
        version,
        description,
    });
    writeJson(
        join(harnessRoot("kiro"), "plugin.json"),
        createAgentPluginManifest({ name: profileId, version, description }),
    );

    const junieRoot = join(harnessRoot("junie"), `extensions/${profileId}`);
    copySkills(skills, junieRoot);
    writeJson(join(junieRoot, "extension.json"), {
        name: profileId,
        description,
    });

    const piRoot = harnessRoot("pi");
    copySkills(skills, piRoot);
    writeJson(join(piRoot, "package.json"), {
        name: packageName,
        version,
        description,
        private: piPrivate,
        license: "MIT",
        files: ["skills"],
        keywords: ["pi-package", "cratis"],
        pi: { skills: ["./skills"] },
    });

    const canonicalFiles = new Map();
    for (const skill of skills)
        for (const file of skill.files)
            canonicalFiles.set(
                `skills/${skill.name}/${file.path}`,
                sha256(file.content),
            );
    for (const harness of passiveHarnesses) {
        const harnessPath = harnessRoot(harness);
        const files = walkFiles(harnessPath).sort();
        const skillFiles = files.filter(
            (path) => path.includes("/skills/") || path.startsWith("skills/"),
        );
        for (const [canonicalPath, digest] of canonicalFiles) {
            const suffix = canonicalPath;
            const matches = skillFiles.filter((path) => path.endsWith(suffix));
            if (matches.length !== 1)
                throw new Error(
                    `${harness}: expected one copy of ${canonicalPath}, found ${matches.length}`,
                );
            if (sha256(readFileSync(join(harnessPath, matches[0]))) !== digest)
                throw new Error(`${harness}: canonical byte parity failed`);
        }
    }
    return {
        harnesses: passiveHarnesses,
        roots: Object.fromEntries(
            passiveHarnesses.map((harness) => [
                harness,
                `harnesses/${harness}`,
            ]),
        ),
        files: walkFiles(root)
            .sort()
            .map((path) => {
                const content = readFileSync(join(root, path));
                return {
                    path,
                    size: content.length,
                    sha256: sha256(content),
                };
            }),
    };
}
