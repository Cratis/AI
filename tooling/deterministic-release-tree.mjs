// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from "node:crypto";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { compareOrdinal } from "./catalog-ordering.mjs";

const logicalContents = new WeakMap();
const projectedContents = new WeakMap();

function sha256(content, metrics) {
    if (metrics) metrics.bytesHashed += content.length;
    return createHash("sha256").update(content).digest("hex");
}

function collisionKey(path) {
    return path.normalize("NFC").toLocaleLowerCase("en-US");
}

function validateRelativePath(path, label = "Release path") {
    if (typeof path !== "string" || path.length === 0)
        throw new Error(`${label} must be a non-empty string`);
    if (path.includes("\\"))
        throw new Error(`${label} must use forward slashes: ${path}`);
    if (isAbsolute(path) || /^[A-Za-z]:\//.test(path))
        throw new Error(`${label} must be relative: ${path}`);
    const segments = path.split("/");
    if (
        segments.some(
            (segment) => segment === "" || segment === "." || segment === "..",
        )
    )
        throw new Error(`${label} escapes or is not normalized: ${path}`);
    return path;
}

function assertNoPathCollisions(paths, label) {
    const exact = new Set();
    const normalized = new Map();
    for (const path of paths) {
        validateRelativePath(path, label);
        if (exact.has(path)) throw new Error(`${label} is duplicated: ${path}`);
        exact.add(path);
        const key = collisionKey(path);
        const existing = normalized.get(key);
        if (existing !== undefined)
            throw new Error(
                `${label} has a normalized, case, or Unicode collision: ${existing} and ${path}`,
            );
        normalized.set(key, path);
    }
    for (const path of paths) {
        const segments = path.split("/");
        for (let index = 1; index < segments.length; index += 1) {
            const parent = segments.slice(0, index).join("/");
            if (exact.has(parent) || normalized.has(collisionKey(parent)))
                throw new Error(
                    `${label} has a file/directory collision: ${parent}`,
                );
        }
    }
}

function assertContained(root, path, label) {
    const relativePath = relative(root, path);
    if (
        relativePath === "" ||
        relativePath === ".." ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)
    )
        throw new Error(`${label} escapes its root: ${path}`);
}

function readApprovedFileOnce(sourceRoot, path, metrics) {
    const root = realpathSync(sourceRoot);
    let current = root;
    for (const segment of path.split("/")) {
        current = join(current, segment);
        const stat = lstatSync(current);
        if (stat.isSymbolicLink())
            throw new Error(`Symlink or junction is forbidden: ${path}`);
    }
    const stat = lstatSync(current);
    if (!stat.isFile())
        throw new Error(`Special or non-regular file is forbidden: ${path}`);
    assertContained(root, realpathSync(current), `Approved source ${path}`);
    const content = readFileSync(current);
    if (metrics) metrics.sourceReads += 1;
    return content;
}

function frozenFileRecord(path, content, metrics, extra = {}) {
    const immutableContent = Buffer.from(content);
    const record = Object.freeze({
        ...extra,
        path,
        size: immutableContent.length,
        sha256: sha256(immutableContent, metrics),
    });
    return { record, content: immutableContent };
}

function normalizeLogicalInput(options) {
    if (Array.isArray(options)) return { files: options };
    if (!options || typeof options !== "object")
        throw new Error("Logical tree options are required");
    if (options.sourceRoot || options.approvedFiles) {
        if (!options.sourceRoot || !Array.isArray(options.approvedFiles))
            throw new Error(
                "sourceRoot and approvedFiles must be supplied together",
            );
        return {
            ...options,
            files: options.approvedFiles.map((file) =>
                typeof file === "string" ? { path: file } : file,
            ),
        };
    }
    return options;
}

/**
 * Creates an immutable logical inventory. Approved disk sources are read once
 * and every logical payload is hashed once. Buffer bytes remain private to the
 * returned tree; consumers receive defensive copies through read().
 */
export function createLogicalTree(input) {
    const options = normalizeLogicalInput(input);
    if (!Array.isArray(options.files) || options.files.length === 0)
        throw new Error("Logical tree requires at least one file");
    const metrics = options.metrics ?? {
        sourceReads: 0,
        finalReads: 0,
        bytesHashed: 0,
    };
    const paths = options.files.map((file) => file.path);
    assertNoPathCollisions(paths, "Logical path");
    const contents = new Map();
    const records = options.files
        .map((file) => {
            validateRelativePath(file.path, "Logical path");
            const content =
                file.content === undefined
                    ? readApprovedFileOnce(
                          options.sourceRoot,
                          file.path,
                          metrics,
                      )
                    : file.content;
            if (!Buffer.isBuffer(content))
                throw new Error(
                    `Logical content must be a Buffer: ${file.path}`,
                );
            const { record, content: immutableContent } = frozenFileRecord(
                file.path,
                content,
                metrics,
                file.sourcePath ? { sourcePath: file.sourcePath } : {},
            );
            contents.set(file.path, immutableContent);
            return record;
        })
        .sort((left, right) => compareOrdinal(left.path, right.path));
    const internalByPath = new Map(
        records.map((record) => [record.path, record]),
    );
    const byPath = Object.freeze({
        get(path) {
            return internalByPath.get(path);
        },
        has(path) {
            return internalByPath.has(path);
        },
    });
    const tree = Object.freeze({
        kind: "cratis-logical-release-tree-v1",
        files: Object.freeze(records),
        byPath,
        metrics,
        read(path) {
            const content = contents.get(path);
            if (!content) throw new Error(`Unknown logical path: ${path}`);
            return Buffer.from(content);
        },
    });
    logicalContents.set(tree, contents);
    return tree;
}

function projectionMappings(root) {
    const mappings = root.mappings ?? root.files ?? root.projections;
    if (!Array.isArray(mappings) || mappings.length === 0)
        throw new Error(
            `Projection root ${root.id ?? root.root ?? root.outputRoot} has no explicit paths`,
        );
    return mappings.map((mapping) => {
        if (typeof mapping === "string")
            return { sourcePath: mapping, path: mapping };
        return {
            sourcePath: mapping.sourcePath ?? mapping.logicalPath,
            path: mapping.path ?? mapping.targetPath ?? mapping.projectedPath,
        };
    });
}

/** Projects one logical tree into one or more fully explicit declared roots. */
export function projectLogicalTree(logicalTree, rootDescriptors, options = {}) {
    const logical = logicalContents.get(logicalTree);
    if (!logical) throw new Error("A createLogicalTree result is required");
    const descriptors = Array.isArray(rootDescriptors)
        ? rootDescriptors
        : rootDescriptors?.roots;
    if (!Array.isArray(descriptors) || descriptors.length === 0)
        throw new Error("At least one projection root is required");
    const rootIds = descriptors.map((root) => root.id);
    const rootPaths = descriptors.map(
        (root) => root.root ?? root.outputRoot ?? root.path,
    );
    assertNoPathCollisions(rootPaths, "Projection root path");
    if (new Set(rootIds).size !== rootIds.length || rootIds.some((id) => !id))
        throw new Error("Projection root ids must be unique and non-empty");

    const contents = new Map();
    const roots = descriptors
        .map((descriptor) => {
            const rootPath =
                descriptor.root ?? descriptor.outputRoot ?? descriptor.path;
            validateRelativePath(rootPath, "Projection root path");
            const mappings = projectionMappings(descriptor);
            assertNoPathCollisions(
                mappings.map((mapping) => mapping.path),
                `${descriptor.id} projection path`,
            );
            const files = mappings
                .map((mapping) => {
                    validateRelativePath(
                        mapping.sourcePath,
                        "Logical source path",
                    );
                    validateRelativePath(mapping.path, "Projected path");
                    const source = logicalTree.byPath.get(mapping.sourcePath);
                    const content = logical.get(mapping.sourcePath);
                    if (!source || !content)
                        throw new Error(
                            `${descriptor.id} references unknown logical path: ${mapping.sourcePath}`,
                        );
                    const fullPath = `${rootPath}/${mapping.path}`;
                    if (contents.has(fullPath))
                        throw new Error(
                            `Projected path is duplicated: ${fullPath}`,
                        );
                    contents.set(fullPath, content);
                    return Object.freeze({
                        path: mapping.path,
                        sourcePath: mapping.sourcePath,
                        size: source.size,
                        sha256: source.sha256,
                    });
                })
                .sort((left, right) => compareOrdinal(left.path, right.path));
            return Object.freeze({
                id: descriptor.id,
                root: rootPath,
                parityGroup: descriptor.parityGroup ?? descriptor.id,
                files: Object.freeze(files),
            });
        })
        .sort((left, right) => compareOrdinal(left.root, right.root));
    assertNoPathCollisions([...contents.keys()], "Projected release path");
    const projected = Object.freeze({
        kind: "cratis-projected-release-tree-v1",
        roots: Object.freeze(roots),
        files: Object.freeze(
            [...contents.keys()].sort(compareOrdinal).map((path) => {
                const root = roots.find((candidate) =>
                    path.startsWith(`${candidate.root}/`),
                );
                const projectedPath = path.slice(root.root.length + 1);
                const file = root.files.find(
                    (candidate) => candidate.path === projectedPath,
                );
                return Object.freeze({
                    path,
                    size: file.size,
                    sha256: file.sha256,
                    rootId: root.id,
                    sourcePath: file.sourcePath,
                });
            }),
        ),
        concurrency: options.concurrency ?? 1,
    });
    projectedContents.set(projected, contents);
    return projected;
}

function walkActualFiles(root, current = root) {
    const files = [];
    for (const entry of readdirSync(current, { withFileTypes: true })) {
        const absolutePath = join(current, entry.name);
        const path = relative(root, absolutePath).split(sep).join("/");
        const stat = lstatSync(absolutePath);
        if (stat.isSymbolicLink())
            throw new Error(
                `Projected root contains a symlink or junction: ${path}`,
            );
        if (stat.isDirectory())
            files.push(...walkActualFiles(root, absolutePath));
        else if (stat.isFile()) files.push(path);
        else throw new Error(`Projected root contains a special file: ${path}`);
    }
    return files;
}

/** Rereads and hashes every final file, then compares complete expected/actual inventories. */
export function validateProjectedRoot(
    destination,
    projectedTree,
    options = {},
) {
    const root = realpathSync(destination);
    const expected = projectedTree.files;
    const actualPaths = walkActualFiles(root).sort(compareOrdinal);
    assertNoPathCollisions(actualPaths, "Actual projected path");
    const expectedPaths = expected.map((file) => file.path);
    if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths))
        throw new Error(
            "Projected root inventory differs from the complete declared inventory",
        );
    const metrics = options.metrics ?? { finalReads: 0, bytesHashed: 0 };
    const expectedByPath = new Map(expected.map((file) => [file.path, file]));
    const files = actualPaths.map((path) => {
        const absolutePath = join(root, path);
        assertContained(
            root,
            realpathSync(absolutePath),
            `Projected file ${path}`,
        );
        const content = readFileSync(absolutePath);
        metrics.finalReads = (metrics.finalReads ?? 0) + 1;
        const digest = sha256(content, metrics);
        const declared = expectedByPath.get(path);
        if (content.length !== declared.size || digest !== declared.sha256)
            throw new Error(`Projected root digest mismatch: ${path}`);
        return Object.freeze({ path, size: content.length, sha256: digest });
    });
    return Object.freeze({
        state: "COMPLETE_ACTUAL_INVENTORY_VALIDATED",
        files: Object.freeze(files),
        fileCount: files.length,
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    });
}

/** Creates a new candidate, writes exclusively in ordinal order, validates fully, and cleans up atomically on failure. */
export function writeProjectedRoot(destination, projectedTree, options = {}) {
    const contents = projectedContents.get(projectedTree);
    if (!contents) throw new Error("A projectLogicalTree result is required");
    const root = resolve(destination);
    if (existsSync(root))
        throw new Error(`Projected destination must not exist: ${root}`);
    const concurrency = options.concurrency ?? projectedTree.concurrency ?? 1;
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
        throw new Error(
            "Projection concurrency must be an integer from 1 through 4",
        );
    let created = false;
    try {
        mkdirSync(root, { recursive: false });
        created = true;
        for (const [index, path] of [...contents.keys()]
            .sort(compareOrdinal)
            .entries()) {
            options.beforeWrite?.({ index, path, destination: root });
            const destinationPath = join(root, path);
            assertContained(
                root,
                destinationPath,
                `Projected destination ${path}`,
            );
            mkdirSync(dirname(destinationPath), { recursive: true });
            writeFileSync(destinationPath, contents.get(path), { flag: "wx" });
        }
        return validateProjectedRoot(root, projectedTree, options);
    } catch (error) {
        if (created) rmSync(root, { recursive: true, force: true });
        throw error;
    }
}

export function buildGlobalReleaseManifest(
    projectedTree,
    validation,
    metadata = {},
) {
    if (validation?.state !== "COMPLETE_ACTUAL_INVENTORY_VALIDATED")
        throw new Error(
            "A complete final projected-root validation is required",
        );
    const roots = projectedTree.roots.map((root) => ({
        id: root.id,
        path: root.root,
        parityGroup: root.parityGroup,
        files: root.files.map((file) => ({
            path: file.path,
            sourcePath: file.sourcePath,
            size: file.size,
            sha256: file.sha256,
        })),
    }));
    return Object.freeze({
        ...metadata,
        schemaVersion: "1.0.0",
        state: "DETERMINISTIC_RELEASE_TREE_VALIDATED",
        roots,
        files: validation.files,
        fileCount: validation.fileCount,
        totalBytes: validation.totalBytes,
        supportGranted: false,
        publicationGranted: false,
        runtimeGranted: false,
        promotionGranted: false,
    });
}
