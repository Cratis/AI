#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    cpSync,
    existsSync,
    lstatSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const distributionCheckNames = Object.freeze([
    "exact-inventory",
    "canonical-byte-parity",
    "native-manifest-parse",
    "checksums",
    "fixture-provenance-record",
    "pack-install-smoke-uninstall",
    "canary-rollback-simulation",
]);

const controlPlanePaths = Object.freeze([
    ".github/scripts/verify-generated-distribution.mjs",
    ".github/workflows/verify-generated-distribution.yml",
]);
const candidateArtifactIds = new Set([
    "candidate-passive-engineering-package",
    "candidate-passive-public-package",
]);
const candidateVersionPattern =
    /^0\.0\.(?:0|[1-9][0-9]*)-candidate\.(?:0|[1-9][0-9]*)$/;

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

function strictJsonParse(text) {
    let index = 0;
    const fail = (message) => {
        throw new Error(`${message} at character ${index}`);
    };
    const skipWhitespace = () => {
        while ([" ", "\t", "\n", "\r"].includes(text[index])) index++;
    };
    const validateUnicodeScalars = (value) => {
        for (let offset = 0; offset < value.length; offset++) {
            const unit = value.charCodeAt(offset);
            if (unit >= 0xd800 && unit <= 0xdbff) {
                const next = value.charCodeAt(offset + 1);
                if (!(next >= 0xdc00 && next <= 0xdfff))
                    fail("JSON string contains an unpaired high surrogate");
                offset++;
            } else if (unit >= 0xdc00 && unit <= 0xdfff) {
                fail("JSON string contains an unpaired low surrogate");
            }
        }
    };
    const parseString = () => {
        if (text[index] !== '"') fail("Expected JSON string");
        const start = index++;
        while (index < text.length) {
            const character = text[index++];
            if (character === '"') {
                try {
                    const value = JSON.parse(text.slice(start, index));
                    validateUnicodeScalars(value);
                    return value;
                } catch {
                    fail("Invalid JSON string");
                }
            }
            if (character === "\\") {
                if (index >= text.length) fail("Trailing JSON escape");
                const escape = text[index++];
                if (escape === "u") {
                    const hexadecimal = text.slice(index, index + 4);
                    if (!/^[0-9a-fA-F]{4}$/u.test(hexadecimal))
                        fail("Invalid JSON Unicode escape");
                    index += 4;
                } else if (!'"\\/bfnrt'.includes(escape)) {
                    fail(`Invalid JSON escape \\${escape}`);
                }
            } else if (character.charCodeAt(0) < 0x20) {
                fail("JSON string contains a control character");
            }
        }
        fail("Unterminated JSON string");
    };
    const parseValue = () => {
        skipWhitespace();
        const character = text[index];
        if (character === '"') return parseString();
        if (character === "{") {
            index++;
            const value = Object.create(null);
            const keys = new Set();
            skipWhitespace();
            if (text[index] === "}") {
                index++;
                return value;
            }
            while (index < text.length) {
                skipWhitespace();
                const key = parseString();
                if (keys.has(key))
                    fail(`Duplicate JSON object key ${JSON.stringify(key)}`);
                keys.add(key);
                skipWhitespace();
                if (text[index++] !== ":")
                    fail("Expected colon after JSON object key");
                value[key] = parseValue();
                skipWhitespace();
                const delimiter = text[index++];
                if (delimiter === "}") return value;
                if (delimiter !== ",") fail("Expected comma or closing brace");
            }
            fail("Unterminated JSON object");
        }
        if (character === "[") {
            index++;
            const value = [];
            skipWhitespace();
            if (text[index] === "]") {
                index++;
                return value;
            }
            while (index < text.length) {
                value.push(parseValue());
                skipWhitespace();
                const delimiter = text[index++];
                if (delimiter === "]") return value;
                if (delimiter !== ",")
                    fail("Expected comma or closing bracket");
            }
            fail("Unterminated JSON array");
        }
        for (const [literal, value] of [
            ["true", true],
            ["false", false],
            ["null", null],
        ]) {
            if (text.startsWith(literal, index)) {
                index += literal.length;
                return value;
            }
        }
        const number = text
            .slice(index)
            .match(
                /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u,
            )?.[0];
        if (number) {
            index += number.length;
            const value = Number(number);
            if (!Number.isFinite(value)) fail("JSON number is not finite");
            if (!Number.isSafeInteger(value) && Number.isInteger(value))
                fail("JSON integer exceeds the safe range");
            return value;
        }
        fail("Invalid JSON value");
    };
    const value = parseValue();
    skipWhitespace();
    if (index !== text.length) fail("Unexpected trailing JSON content");
    return value;
}

function readJson(path) {
    try {
        return strictJsonParse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`Unable to parse JSON: ${path}`, { cause: error });
    }
}

function walkFiles(root, current = root) {
    return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        if (entry.name === ".git" && current === root) return [];
        const path = join(current, entry.name);
        const relativePath = relative(root, path).replaceAll("\\", "/");
        if (entry.isSymbolicLink())
            throw new Error(`Distribution repository symlink is forbidden: ${relativePath}`);
        if (entry.isDirectory()) return walkFiles(root, path);
        if (!entry.isFile())
            throw new Error(`Distribution repository special file is forbidden: ${relativePath}`);
        return [relativePath];
    });
}

function assertSafeRelativePath(path) {
    if (
        typeof path !== "string" ||
        path.length === 0 ||
        isAbsolute(path) ||
        path.includes("\\") ||
        path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ) {
        throw new Error(`Unsafe distribution manifest path: ${String(path)}`);
    }
}

function isContained(root, candidate) {
    const relativePath = relative(resolve(root), resolve(candidate));
    return (
        relativePath.length > 0 &&
        !isAbsolute(relativePath) &&
        relativePath !== ".." &&
        !relativePath.startsWith("../")
    );
}

function normalizeSafePackageRelativePath(path) {
    const normalized = typeof path === "string" && path.startsWith("./")
        ? path.slice(2)
        : path;
    assertSafeRelativePath(normalized);
    return normalized;
}

function assertSafePackageMetadata(packageValue) {
    if (
        typeof packageValue.name !== "string" ||
        !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(
            packageValue.name,
        )
    ) {
        throw new Error("Distribution package name is unsafe");
    }
    for (const field of [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies",
        "scripts",
    ]) {
        if (
            packageValue[field] !== undefined &&
            (typeof packageValue[field] !== "object" ||
                packageValue[field] === null ||
                Object.keys(packageValue[field]).length > 0)
        ) {
            throw new Error(`Distribution package ${field} must be empty`);
        }
    }
    for (const field of ["bundleDependencies", "bundledDependencies"]) {
        if (
            packageValue[field] !== undefined &&
            (!Array.isArray(packageValue[field]) || packageValue[field].length > 0)
        ) {
            throw new Error(`Distribution package ${field} must be empty`);
        }
    }
    return packageValue.pi.skills.map(normalizeSafePackageRelativePath);
}

function loadManifest(root) {
    const manifestPath = join(root, "distribution-manifest.json");
    const manifest = readJson(manifestPath);
    if (!Array.isArray(manifest.files) || !Array.isArray(manifest.generatedTargets))
        throw new Error("Distribution manifest inventory is malformed");
    const paths = manifest.files.map((file) => file.path);
    for (const path of paths) assertSafeRelativePath(path);
    if (new Set(paths).size !== paths.length)
        throw new Error("Distribution manifest contains duplicate paths");
    return manifest;
}

function verifyManifestedFiles(root, manifest) {
    for (const file of manifest.files) {
        const content = readFileSync(join(root, file.path));
        if (
            !Number.isSafeInteger(file.size) ||
            content.length !== file.size ||
            file.sha256 !== sha256(content)
        ) {
            throw new Error(`Distribution manifest digest mismatch: ${file.path}`);
        }
    }
}

function verifyCandidateReviewRoot(root, candidateRoot) {
    const [rootName, artifactId, version, ...extra] = candidateRoot.split("/");
    if (
        rootName !== "candidates" ||
        !candidateArtifactIds.has(artifactId) ||
        !candidateVersionPattern.test(version) ||
        extra.length > 0
    ) {
        throw new Error(`Invalid Distribution candidate root: ${candidateRoot}`);
    }
    const absoluteRoot = join(root, candidateRoot);
    const actualPaths = walkFiles(absoluteRoot).sort();
    for (const required of [
        "candidate-assets.json",
        "candidate-component-coverage.json",
        "SHA256SUMS",
    ])
        if (!actualPaths.includes(required))
            throw new Error(`${candidateRoot}: missing ${required}`);
    const manifest = readJson(join(absoluteRoot, "candidate-assets.json"));
    if (
        manifest.schemaPath !==
            "distribution/passive-candidate-assets.schema.json" ||
        !/^[0-9a-f]{64}$/.test(manifest.schemaSha256) ||
        manifest.state !== "PASSIVE_CANDIDATE_REVIEW_ONLY" ||
        manifest.artifactId !== artifactId ||
        manifest.version !== version ||
        !/^[0-9a-f]{40}$/.test(manifest.sourceCommit) ||
        !/^[0-9a-f]{64}$/.test(manifest.generatorDigest) ||
        manifest.componentCoveragePath !==
            "candidate-component-coverage.json" ||
        !/^[0-9a-f]{64}$/.test(manifest.componentCoverageSha256) ||
        !Array.isArray(manifest.assets) ||
        manifest.assets.length === 0 ||
        manifest.approvalEligible !== false ||
        manifest.installationSupported !== false ||
        manifest.publicationEligible !== false ||
        manifest.runtimeEligible !== false ||
        manifest.supportGranted !== false ||
        manifest.promotionEligible !== false
    ) {
        throw new Error(`${candidateRoot}: candidate manifest authority changed`);
    }
    const componentCoverageBytes = readFileSync(
        join(absoluteRoot, manifest.componentCoveragePath),
    );
    if (sha256(componentCoverageBytes) !== manifest.componentCoverageSha256)
        throw new Error(
            `${candidateRoot}: component coverage digest mismatch`,
        );
    const componentCoverage = readJson(
        join(absoluteRoot, manifest.componentCoveragePath),
    );
    if (
        componentCoverage.schemaPath !==
            "distribution/candidate-component-coverage.schema.json" ||
        !/^[0-9a-f]{64}$/.test(componentCoverage.schemaSha256) ||
        componentCoverage.state !==
            "CANDIDATE_COMPONENT_COVERAGE_REVIEW_ONLY" ||
        componentCoverage.componentCount !== 137 ||
        componentCoverage.byDisposition?.["skill-packaged-candidate"] !== 41 ||
        componentCoverage.byDisposition?.["skill-blocked-candidate"] !== 4 ||
        componentCoverage.byDisposition?.["skill-legacy-repository-only"] !== 4 ||
        componentCoverage.byDisposition?.["native-static-review-projected"] !== 35 ||
        componentCoverage.byDisposition?.["native-static-unprojected"] !== 2 ||
        componentCoverage.byDisposition?.["repository-host-adapter-only"] !== 48 ||
        componentCoverage.byDisposition?.["executable-blocked"] !== 3 ||
        !Array.isArray(componentCoverage.records) ||
        componentCoverage.records.length !== 137 ||
        componentCoverage.approvalGranted !== false ||
        componentCoverage.installationSupported !== false ||
        componentCoverage.publicationEligible !== false ||
        componentCoverage.runtimeEligible !== false ||
        componentCoverage.supportGranted !== false ||
        componentCoverage.promotionEligible !== false
    ) {
        throw new Error(`${candidateRoot}: component coverage authority changed`);
    }
    const assetPaths = [];
    for (const asset of manifest.assets) {
        assertSafeRelativePath(asset.filename);
        if (asset.filename.includes("/"))
            throw new Error(`${candidateRoot}: nested candidate asset is forbidden`);
        const content = readFileSync(join(absoluteRoot, asset.filename));
        if (
            !Number.isSafeInteger(asset.size) ||
            content.length !== asset.size ||
            asset.sha256 !== sha256(content)
        ) {
            throw new Error(
                `${candidateRoot}: candidate asset digest mismatch: ${asset.filename}`,
            );
        }
        assetPaths.push(asset.filename);
    }
    if (new Set(assetPaths).size !== assetPaths.length)
        throw new Error(`${candidateRoot}: duplicate candidate assets`);
    const checksumLines = readFileSync(join(absoluteRoot, "SHA256SUMS"), "utf8")
        .trim()
        .split("\n");
    const checksumPaths = checksumLines.map((line) => {
        const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
        if (!match) throw new Error(`${candidateRoot}: malformed checksum line`);
        assertSafeRelativePath(match[2]);
        if (sha256(readFileSync(join(absoluteRoot, match[2]))) !== match[1])
            throw new Error(
                `${candidateRoot}: checksum verification failed: ${match[2]}`,
            );
        return match[2];
    });
    if (new Set(checksumPaths).size !== checksumPaths.length)
        throw new Error(`${candidateRoot}: duplicate checksum paths`);
    const expectedChecksumPaths = actualPaths
        .filter((path) => path !== "SHA256SUMS")
        .sort();
    if (
        JSON.stringify(checksumPaths.sort()) !==
        JSON.stringify(expectedChecksumPaths)
    ) {
        throw new Error(`${candidateRoot}: checksum inventory is incomplete`);
    }
}

function verifyExactInventory(root) {
    const manifest = loadManifest(root);
    const actualPaths = walkFiles(root).sort();
    const actualControlPlanePaths = actualPaths.filter((path) => path.startsWith(".github/"));
    if (
        actualControlPlanePaths.length > 0 &&
        JSON.stringify(actualControlPlanePaths) !==
            JSON.stringify([...controlPlanePaths].sort())
    ) {
        throw new Error("Distribution repository control-plane inventory changed");
    }
    const candidatePaths = actualPaths.filter((path) =>
        path.startsWith("candidates/"),
    );
    const candidateRoots = [
        ...new Set(
            candidatePaths.map((path) => {
                const segments = path.split("/");
                if (segments.length < 4)
                    throw new Error(`Invalid Distribution candidate path: ${path}`);
                return segments.slice(0, 3).join("/");
            }),
        ),
    ].sort();
    for (const candidateRoot of candidateRoots)
        verifyCandidateReviewRoot(root, candidateRoot);
    const payloadPaths = actualPaths.filter(
        (path) =>
            !path.startsWith(".github/") &&
            !path.startsWith("candidates/"),
    );
    const expectedPayloadPaths = [
        ...manifest.files.map((file) => file.path),
        "distribution-manifest.json",
    ].sort();
    if (JSON.stringify(payloadPaths) !== JSON.stringify(expectedPayloadPaths))
        throw new Error("Distribution repository exact inventory changed");
    verifyManifestedFiles(root, manifest);
    return manifest;
}

function verifyCanonicalByteParity(root) {
    const manifest = verifyExactInventory(root);
    const provenance = readJson(join(root, "provenance.json"));
    if (!Array.isArray(provenance.canonicalFiles) || provenance.canonicalFiles.length === 0)
        throw new Error("Distribution provenance canonical inventory is missing");
    const manifestedPaths = manifest.files.map((file) => file.path);
    const expectedTargets = [...manifest.generatedTargets].sort();
    for (const file of provenance.canonicalFiles) {
        assertSafeRelativePath(file.path);
        const canonicalPath = `canonical/${file.path}`;
        const canonical = readFileSync(join(root, canonicalPath));
        if (
            canonical.length !== file.size ||
            sha256(canonical) !== file.sha256
        ) {
            throw new Error(`Canonical provenance mismatch: ${file.path}`);
        }
        const copies = manifestedPaths.filter(
            (path) => path === canonicalPath || path.endsWith(`/${file.path}`),
        );
        const actualTargets = copies.map((path) => path.split("/", 1)[0]).sort();
        if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets))
            throw new Error(`Canonical projection inventory changed: ${file.path}`);
        for (const path of copies) {
            if (!readFileSync(join(root, path)).equals(canonical))
                throw new Error(`Canonical byte parity failed: ${path}`);
        }
    }
}

function verifyNativeManifests(root) {
    const manifest = verifyExactInventory(root);
    const jsonPaths = manifest.files
        .map((file) => file.path)
        .filter((path) => path.endsWith(".json"));
    if (jsonPaths.length === 0)
        throw new Error("Distribution contains no native JSON manifests");
    for (const path of jsonPaths) readJson(join(root, path));
}

function verifyChecksums(root) {
    const manifest = verifyExactInventory(root);
    const lines = readFileSync(join(root, "SHA256SUMS"), "utf8")
        .trim()
        .split("\n");
    const paths = lines.map((line) => {
        const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
        if (!match) throw new Error(`Malformed checksum line: ${line}`);
        assertSafeRelativePath(match[2]);
        if (sha256(readFileSync(join(root, match[2]))) !== match[1])
            throw new Error(`Checksum verification failed: ${match[2]}`);
        return match[2];
    });
    if (new Set(paths).size !== paths.length)
        throw new Error("SHA256SUMS contains duplicate paths");
    const expectedPaths = manifest.files
        .map((file) => file.path)
        .filter((path) => path !== "SHA256SUMS")
        .sort();
    if (JSON.stringify(paths.sort()) !== JSON.stringify(expectedPaths))
        throw new Error("SHA256SUMS does not cover the exact manifested inventory");
}

function verifyFixtureProvenance(root) {
    const manifest = verifyExactInventory(root);
    const provenance = readJson(join(root, "provenance.json"));
    if (
        manifest.state !== "FIXTURE_ONLY_LOCAL_STAGING" ||
        manifest.publicationEligible !== false ||
        manifest.promotionEligible !== false ||
        provenance.state !== "FIXTURE_ONLY_NOT_AN_ATTESTATION" ||
        provenance.canonicalRepository !== "Cratis/AI" ||
        provenance.generator !== "tooling/generate-distribution-fixture.mjs" ||
        provenance.version !== manifest.version ||
        provenance.publicationEligible !== false ||
        provenance.promotionEligible !== false
    ) {
        throw new Error("Fixture provenance or eligibility state changed");
    }
}

function runNpm(arguments_, cwd, environment) {
    return execFileSync("npm", arguments_, {
        cwd,
        env: environment,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
}

function verifyPackInstallSmokeUninstall(root) {
    const manifest = verifyExactInventory(root);
    const packageCandidates = manifest.files
        .map((file) => file.path)
        .filter((path) => path.endsWith("package.json"))
        .map((path) => ({ path, value: readJson(join(root, path)) }))
        .filter((candidate) => Array.isArray(candidate.value.pi?.skills));
    if (packageCandidates.length !== 1)
        throw new Error("Distribution must contain exactly one Pi package manifest");
    const candidate = packageCandidates[0];
    const skillRoots = assertSafePackageMetadata(candidate.value);
    const packageRoot = dirname(join(root, candidate.path));
    const temporaryRoot = mkdtempSync(join(tmpdir(), "cratis-distribution-pack-"));
    let archivePath;
    try {
        const cacheRoot = join(temporaryRoot, "npm-cache");
        const environment = {
            ...process.env,
            npm_config_cache: cacheRoot,
            npm_config_audit: "false",
            npm_config_fund: "false",
            npm_config_ignore_scripts: "true",
            npm_config_offline: "true",
            npm_config_update_notifier: "false",
        };
        const packResult = JSON.parse(
            runNpm(["pack", "--json", "--ignore-scripts"], packageRoot, environment),
        );
        if (
            !Array.isArray(packResult) ||
            packResult.length !== 1 ||
            typeof packResult[0].filename !== "string"
        ) {
            throw new Error("npm pack did not produce exactly one package");
        }
        archivePath = resolve(packageRoot, packResult[0].filename);
        if (!isContained(packageRoot, archivePath))
            throw new Error("npm pack returned an unsafe archive path");
        const installRoot = join(temporaryRoot, "install");
        mkdirSync(installRoot);
        writeFileSync(
            join(installRoot, "package.json"),
            `${JSON.stringify({ private: true }, null, 2)}\n`,
        );
        runNpm(
            [
                "install",
                "--offline",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--package-lock=false",
                archivePath,
            ],
            installRoot,
            environment,
        );
        const packagePath = join(
            installRoot,
            "node_modules",
            ...candidate.value.name.split("/"),
        );
        if (!isContained(join(installRoot, "node_modules"), packagePath))
            throw new Error("Installed package path escaped node_modules");
        if (!existsSync(packagePath))
            throw new Error("Packed Distribution package was not installed");
        for (const skillRoot of skillRoots) {
            const installedSkillRoot = resolve(packagePath, skillRoot);
            if (
                !isContained(packagePath, installedSkillRoot) ||
                !existsSync(installedSkillRoot)
            ) {
                throw new Error(`Installed Pi skill root is missing: ${skillRoot}`);
            }
        }
        runNpm(
            [
                "uninstall",
                "--offline",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--package-lock=false",
                "--",
                candidate.value.name,
            ],
            installRoot,
            environment,
        );
        if (existsSync(packagePath))
            throw new Error("Packed Distribution package was not uninstalled");
    } finally {
        if (archivePath && isContained(packageRoot, archivePath))
            rmSync(archivePath, { force: true });
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

function copyManifestedRepository(sourceRoot, destinationRoot) {
    const manifest = verifyExactInventory(sourceRoot);
    mkdirSync(destinationRoot, { recursive: true });
    for (const path of [
        ...manifest.files.map((file) => file.path),
        "distribution-manifest.json",
    ]) {
        const destination = join(destinationRoot, path);
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(join(sourceRoot, path), destination);
    }
    return manifest;
}

function verifyCanaryRollbackSimulation(root, beforeRoot) {
    if (!beforeRoot) throw new Error("beforeRoot is required for rollback simulation");
    const temporaryRoot = mkdtempSync(join(tmpdir(), "cratis-distribution-rollback-"));
    try {
        const projectRoot = join(temporaryRoot, "project");
        const installRoot = join(projectRoot, "distribution");
        mkdirSync(projectRoot);
        const contextPath = join(projectRoot, "PROJECT.md");
        const context = "repository-owned context\n";
        writeFileSync(contextPath, context);
        const beforeManifest = copyManifestedRepository(beforeRoot, installRoot);
        rmSync(installRoot, { recursive: true, force: true });
        copyManifestedRepository(root, installRoot);
        rmSync(installRoot, { recursive: true, force: true });
        copyManifestedRepository(beforeRoot, installRoot);
        for (const file of beforeManifest.files) {
            const content = readFileSync(join(installRoot, file.path));
            if (content.length !== file.size || sha256(content) !== file.sha256)
                throw new Error(`Rollback digest mismatch: ${file.path}`);
        }
        rmSync(installRoot, { recursive: true, force: true });
        if (readFileSync(contextPath, "utf8") !== context)
            throw new Error("Repository-owned context changed during rollback simulation");
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

export function verifyDistributionCheck({ root, check, beforeRoot } = {}) {
    const repositoryRoot = resolve(root ?? "");
    if (!root || !existsSync(repositoryRoot) || !lstatSync(repositoryRoot).isDirectory())
        throw new Error("root must be an existing directory");
    if (!distributionCheckNames.includes(check))
        throw new Error(`Unknown Distribution check: ${String(check)}`);
    switch (check) {
        case "exact-inventory":
            verifyExactInventory(repositoryRoot);
            break;
        case "canonical-byte-parity":
            verifyCanonicalByteParity(repositoryRoot);
            break;
        case "native-manifest-parse":
            verifyNativeManifests(repositoryRoot);
            break;
        case "checksums":
            verifyChecksums(repositoryRoot);
            break;
        case "fixture-provenance-record":
            verifyFixtureProvenance(repositoryRoot);
            break;
        case "pack-install-smoke-uninstall":
            verifyPackInstallSmokeUninstall(repositoryRoot);
            break;
        case "canary-rollback-simulation":
            verifyCanaryRollbackSimulation(
                repositoryRoot,
                beforeRoot ? resolve(beforeRoot) : undefined,
            );
            break;
    }
    return { check, status: "PASS", supporting: false };
}

function parseArguments(arguments_) {
    const values = new Map();
    for (let index = 0; index < arguments_.length; index += 2) {
        const name = arguments_[index];
        const value = arguments_[index + 1];
        if (!name?.startsWith("--") || value === undefined)
            throw new Error("Arguments must be --name value pairs");
        values.set(name.slice(2), value);
    }
    return values;
}

function main() {
    try {
        const arguments_ = parseArguments(process.argv.slice(2));
        const result = verifyDistributionCheck({
            root: arguments_.get("root"),
            check: arguments_.get("check"),
            beforeRoot: arguments_.get("before-root"),
        });
        process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Distribution verification failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
