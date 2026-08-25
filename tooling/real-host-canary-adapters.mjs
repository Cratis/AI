// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    accessSync,
    constants,
    existsSync,
    readFileSync,
    realpathSync,
} from "node:fs";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { spawnSync } from "node:child_process";

const sandboxExecutable = "/usr/bin/sandbox-exec";
const sandboxProfile = "(version 1)(allow default)(deny network*)";

function sha256(content) {
    return createHash("sha256").update(content).digest("hex");
}

export function resolveExecutable(command, pathValue = process.env.PATH ?? "") {
    const candidates = isAbsolute(command)
        ? [command]
        : pathValue.split(delimiter).map((root) => join(root, command));
    for (const candidate of candidates) {
        try {
            accessSync(candidate, constants.X_OK);
            return realpathSync(candidate);
        } catch {
            // Continue through the explicit PATH candidate set.
        }
    }
    return null;
}

export function executableDigest(path) {
    return sha256(readFileSync(path));
}

export function createIsolatedEnvironment({ executable, home, temporaryRoot }) {
    const executableDirectory = dirname(executable);
    return Object.freeze({
        HOME: home,
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        NO_COLOR: "1",
        PATH: [executableDirectory, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(
            delimiter,
        ),
        TMPDIR: temporaryRoot,
        XDG_CACHE_HOME: join(home, ".cache"),
        XDG_CONFIG_HOME: join(home, ".config"),
        XDG_DATA_HOME: join(home, ".local/share"),
        XDG_STATE_HOME: join(home, ".local/state"),
    });
}

export function networkSandboxAvailable(platform = process.platform) {
    return platform === "darwin" && existsSync(sandboxExecutable);
}

export function runSandboxedCommand({
    executable,
    args,
    cwd,
    environment,
    timeoutMs = 30_000,
    spawn = spawnSync,
}) {
    if (!networkSandboxAvailable())
        throw new Error("OS-level denied egress is unavailable");
    const argv = ["-p", sandboxProfile, executable, ...args];
    const result = spawn(sandboxExecutable, argv, {
        cwd,
        env: environment,
        encoding: "utf8",
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
    });
    return Object.freeze({
        argv: [sandboxExecutable, ...argv],
        cwd,
        environmentNames: Object.keys(environment).sort(),
        exitCode: result.status ?? -1,
        timedOut: result.signal === "SIGTERM" && result.status === null,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        stdoutDigest: sha256(result.stdout ?? ""),
        stderrDigest: sha256(result.stderr ?? ""),
        error: result.error?.message ?? null,
    });
}

export function commandEvidence(command) {
    return {
        argv: command.argv,
        cwd: command.cwd,
        environmentNames: command.environmentNames,
        exitCode: command.exitCode,
        timedOut: command.timedOut,
        stdoutDigest: command.stdoutDigest,
        stderrDigest: command.stderrDigest,
    };
}
