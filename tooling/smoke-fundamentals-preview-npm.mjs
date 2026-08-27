#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageName = "@cratis/ai-fundamentals";

function npm(arguments_, cwd, environment) {
    return execFileSync("npm", arguments_, {
        cwd,
        env: environment,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
}

function installedPackageRoot(consumerRoot) {
    return join(consumerRoot, "node_modules", "@cratis", "ai-fundamentals");
}

function assertInstalled(consumerRoot, expectedVersion) {
    const packageRoot = installedPackageRoot(consumerRoot);
    let packageJson;
    try {
        packageJson = JSON.parse(
            readFileSync(join(packageRoot, "package.json"), "utf8"),
        );
    } catch (error) {
        throw new Error("Unable to read installed preview package", {
            cause: error,
        });
    }
    if (
        packageJson.name !== packageName ||
        packageJson.version !== expectedVersion ||
        packageJson.private !== false ||
        JSON.stringify(packageJson.pi?.skills) !==
            JSON.stringify(["./skills"]) ||
        !existsSync(
            join(
                packageRoot,
                "skills",
                "cratis-fundamentals-concept",
                "SKILL.md",
            ),
        )
    )
        throw new Error("Installed preview package discovery failed");
}

function install(archivePath, consumerRoot, environment) {
    npm(
        [
            "install",
            "--offline",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--package-lock=false",
            archivePath,
        ],
        consumerRoot,
        environment,
    );
}

function uninstall(consumerRoot, environment) {
    npm(
        [
            "uninstall",
            "--offline",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--package-lock=false",
            "--",
            packageName,
        ],
        consumerRoot,
        environment,
    );
    if (existsSync(installedPackageRoot(consumerRoot)))
        throw new Error("Preview package uninstall left installed files");
}

export function smokeFundamentalsPreviewNpmTransition({
    previousArchivePath,
    previousVersion,
    currentArchivePath,
    currentVersion,
} = {}) {
    if (
        !previousArchivePath ||
        !previousVersion ||
        !currentArchivePath ||
        !currentVersion
    )
        throw new Error("Previous and current archive paths and versions are required");
    const previousArchive = resolve(previousArchivePath);
    const currentArchive = resolve(currentArchivePath);
    if (!existsSync(previousArchive) || !existsSync(currentArchive))
        throw new Error("Preview transition archive does not exist");
    const temporaryRoot = mkdtempSync(join(tmpdir(), "cratis-preview-transition-"));
    try {
        const consumerRoot = join(temporaryRoot, "consumer");
        const cacheRoot = join(temporaryRoot, "npm-cache");
        mkdirSync(consumerRoot);
        const contextPath = join(consumerRoot, "PROJECT.md");
        const context = "repository-owned transition context\n";
        writeFileSync(contextPath, context);
        writeFileSync(
            join(consumerRoot, "package.json"),
            `${JSON.stringify({ private: true }, null, 2)}\n`,
        );
        const environment = {
            ...process.env,
            npm_config_cache: cacheRoot,
            npm_config_audit: "false",
            npm_config_fund: "false",
            npm_config_ignore_scripts: "true",
            npm_config_offline: "true",
            npm_config_update_notifier: "false",
        };
        install(previousArchive, consumerRoot, environment);
        assertInstalled(consumerRoot, previousVersion);
        install(currentArchive, consumerRoot, environment);
        assertInstalled(consumerRoot, currentVersion);
        install(previousArchive, consumerRoot, environment);
        assertInstalled(consumerRoot, previousVersion);
        uninstall(consumerRoot, environment);
        if (readFileSync(contextPath, "utf8") !== context)
            throw new Error("Preview transition changed project context");
        return {
            packageName,
            previousVersion,
            currentVersion,
            phases: [
                "install-previous",
                "update-current",
                "rollback-previous",
                "uninstall",
                "cleanup",
                "project-context-preservation",
            ],
            executionPerformed: true,
            networkAccessPerformed: false,
            supportGranted: false,
        };
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

export function smokeFundamentalsPreviewNpm({
    archivePath,
    expectedVersion,
} = {}) {
    if (!archivePath || !expectedVersion)
        throw new Error("archivePath and expectedVersion are required");
    const archive = resolve(archivePath);
    if (!existsSync(archive))
        throw new Error(`Preview archive does not exist: ${archive}`);
    const temporaryRoot = mkdtempSync(join(tmpdir(), "cratis-preview-smoke-"));
    try {
        const consumerRoot = join(temporaryRoot, "consumer");
        const cacheRoot = join(temporaryRoot, "npm-cache");
        mkdirSync(consumerRoot);
        const contextPath = join(consumerRoot, "PROJECT.md");
        const context = "repository-owned context\n";
        writeFileSync(contextPath, context);
        writeFileSync(
            join(consumerRoot, "package.json"),
            `${JSON.stringify({ private: true }, null, 2)}\n`,
        );
        const environment = {
            ...process.env,
            npm_config_cache: cacheRoot,
            npm_config_audit: "false",
            npm_config_fund: "false",
            npm_config_ignore_scripts: "true",
            npm_config_offline: "true",
            npm_config_update_notifier: "false",
        };
        install(archive, consumerRoot, environment);
        assertInstalled(consumerRoot, expectedVersion);
        uninstall(consumerRoot, environment);
        install(archive, consumerRoot, environment);
        assertInstalled(consumerRoot, expectedVersion);
        uninstall(consumerRoot, environment);
        if (readFileSync(contextPath, "utf8") !== context)
            throw new Error("Preview package lifecycle changed project context");
        return {
            packageName,
            expectedVersion,
            phases: [
                "install",
                "discovery",
                "uninstall",
                "rollback-reinstall",
                "cleanup",
                "project-context-preservation",
            ],
            executionPerformed: true,
            networkAccessPerformed: false,
            supportGranted: false,
        };
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

function main() {
    const [archivePath, expectedVersion] = process.argv.slice(2);
    try {
        const result = smokeFundamentalsPreviewNpm({
            archivePath,
            expectedVersion,
        });
        process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : "Preview smoke failed"}\n`,
        );
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
