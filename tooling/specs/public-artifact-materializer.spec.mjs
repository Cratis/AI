// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    existsSync,
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import {
    discoverSkillPaths,
    materializeFixtureArtifact,
    packFixtureArchive,
    unpackFixtureArchive,
    validateArtifactPath,
    validatePayloadPath,
    validateStagedArtifact,
} from "../public-artifact-materializer.mjs";

const repositoryRoot = resolve(
    dirname(new URL(import.meta.url).pathname),
    "../..",
);
const validFixture = join(
    repositoryRoot,
    "tooling/fixtures/public-artifact/valid-source",
);
const engineeringFixture = join(
    repositoryRoot,
    "tooling/fixtures/public-artifact/engineering-discovery",
);
const approvedFiles = [
    "skills/cratis-example/LICENSE",
    "skills/cratis-example/SKILL.md",
    "skills/cratis-example/assets/example.txt",
    "skills/cratis-example/references/guide.md",
];

function withTemporaryDirectory(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-artifact-spec-"));
    try {
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function copyFixture(root) {
    const source = join(root, "source");
    cpSync(validFixture, source, { recursive: true });
    return source;
}

function writeSourceFile(source, path, content) {
    const destination = join(source, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
}

function materialize(source, root, files = approvedFiles) {
    return materializeFixtureArtifact({
        sourceRoot: source,
        stageRoot: join(root, "stage"),
        manifestPath: join(root, "artifact-files.json"),
        approvedFiles: files,
    });
}

test("materializes an exact allowlist into a new empty stage and hashes every runtime file", () => {
    withTemporaryDirectory((root) => {
        const manifest = materialize(copyFixture(root), root);
        assert.deepEqual(
            manifest.files.map((file) => file.path),
            approvedFiles,
        );
        assert(
            manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)),
        );
        assert.deepEqual(manifest.discoveredSkills, [
            "skills/cratis-example/SKILL.md",
        ]);
        assert.deepEqual(
            JSON.parse(readFileSync(join(root, "artifact-files.json"))),
            manifest,
        );
    });
});

test("packs, safely unpacks, and revalidates a fixture archive", () => {
    withTemporaryDirectory((root) => {
        materialize(copyFixture(root), root);
        const archive = join(root, "fixture-archive.json");
        const packed = packFixtureArchive(join(root, "stage"), archive);
        const unpacked = unpackFixtureArchive(archive, join(root, "unpacked"));
        assert.deepEqual(unpacked, packed);
    });
});

test("rejects traversal, absolute, hidden, forbidden, duplicate, case, and Unicode-colliding paths", () => {
    assert.throws(() => validateArtifactPath("../SKILL.md"), /traversal/);
    assert.throws(
        () => validateArtifactPath("/skills/example/SKILL.md"),
        /Absolute/,
    );
    assert.throws(() => validateArtifactPath("skills/.state/file"), /Hidden/);
    assert.throws(
        () => validatePayloadPath("engineering/skills/example/SKILL.md"),
        /Forbidden/,
    );
    assert.throws(
        () => validatePayloadPath("skills/example/scripts/run.sh"),
        /Forbidden/,
    );

    withTemporaryDirectory((root) => {
        const source = copyFixture(root);
        assert.throws(
            () =>
                materializeFixtureArtifact({
                    sourceRoot: source,
                    stageRoot: join(root, "duplicate"),
                    approvedFiles: [approvedFiles[0], approvedFiles[0]],
                }),
            /duplicate path/,
        );
        assert.throws(
            () =>
                materializeFixtureArtifact({
                    sourceRoot: source,
                    stageRoot: join(root, "case"),
                    approvedFiles: [
                        "skills/cratis-example/SKILL.md",
                        "skills/cratis-example/skill.md",
                    ],
                }),
            /case or Unicode-normalization collision/,
        );
        assert.throws(
            () =>
                materializeFixtureArtifact({
                    sourceRoot: source,
                    stageRoot: join(root, "unicode"),
                    approvedFiles: [
                        "skills/cratis-example/assets/café.txt",
                        "skills/cratis-example/assets/café.txt",
                    ],
                }),
            /case or Unicode-normalization collision/,
        );
    });
});

test("rejects escaping and internal symlinks before copying", () => {
    withTemporaryDirectory((root) => {
        const source = copyFixture(root);
        const external = join(root, "external.txt");
        writeFileSync(external, "outside");
        symlinkSync(
            external,
            join(source, "skills/cratis-example/assets/escaping.txt"),
        );
        symlinkSync(
            "example.txt",
            join(source, "skills/cratis-example/assets/internal.txt"),
        );

        for (const path of ["escaping.txt", "internal.txt"]) {
            assert.throws(
                () =>
                    materializeFixtureArtifact({
                        sourceRoot: source,
                        stageRoot: join(root, `stage-${path}`),
                        approvedFiles: [`skills/cratis-example/assets/${path}`],
                    }),
                /Symlink or junction/,
            );
        }
    });
});

test("rejects special files where the platform can create them", {
    skip: process.platform === "win32",
}, () => {
    withTemporaryDirectory((root) => {
        const source = copyFixture(root);
        const fifo = join(source, "skills/cratis-example/assets/input.fifo");
        execFileSync("mkfifo", [fifo]);
        assert.throws(
            () =>
                materializeFixtureArtifact({
                    sourceRoot: source,
                    stageRoot: join(root, "stage"),
                    approvedFiles: ["skills/cratis-example/assets/input.fifo"],
                }),
            /Special or non-regular/,
        );
    });
});

test("rejects unlinked, escaping, and unresolved skill references", () => {
    withTemporaryDirectory((root) => {
        const source = copyFixture(root);
        writeSourceFile(
            source,
            "skills/cratis-example/SKILL.md",
            "# Fixture\n\n[escape](../../outside.md)\n",
        );
        assert.throws(
            () => materialize(source, root, ["skills/cratis-example/SKILL.md"]),
            /escapes skill root/,
        );
    });

    withTemporaryDirectory((root) => {
        const source = copyFixture(root);
        writeSourceFile(
            source,
            "skills/cratis-example/SKILL.md",
            "# Fixture\n\n[missing](references/missing.md)\n",
        );
        assert.throws(
            () => materialize(source, root, ["skills/cratis-example/SKILL.md"]),
            /Unresolved staged reference/,
        );
        assert.equal(existsSync(join(root, "stage")), false);
        assert.equal(existsSync(join(root, "artifact-files.json")), false);
    });

    withTemporaryDirectory((root) => {
        const source = copyFixture(root);
        writeSourceFile(
            source,
            "skills/cratis-example/references/unlinked.md",
            "# Unlinked\n",
        );
        assert.throws(
            () =>
                materialize(source, root, [
                    ...approvedFiles,
                    "skills/cratis-example/references/unlinked.md",
                ]),
            /Unlinked staged skill resource/,
        );
    });
});

test("rejects secret-shaped, private, and local payload content", () => {
    for (const [name, content] of [
        ["secret", "token=abcdefghijklmnopqrstuvwxyz123456"],
        ["github-token", "github_pat_abcdefghijklmnopqrstuvwxyz123456"],
        ["npm-token", "npm_abcdefghijklmnopqrstuvwxyz123456"],
        ["bearer-token", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz"],
        ["private-host", "https://service.internal/resource"],
        ["private-ipv4", "https://192.168.10.12/resource"],
        ["short-loopback", "http://127.1/resource"],
        ["absolute-localhost", "http://localhost./resource"],
        ["metadata-host", "http://metadata.google.internal./resource"],
        ["metadata-ip", "http://169.254.169.254/latest/meta-data"],
        ["private-ipv6", "http://[::1]"],
        ["unique-local-ipv6", "http://[fd00::1]/resource"],
        ["absolute-local", "/Users/example/private/file"],
        ["windows-local", "C:\\Users\\example\\private.txt"],
    ]) {
        withTemporaryDirectory((root) => {
            const source = copyFixture(root);
            writeSourceFile(
                source,
                "skills/cratis-example/assets/example.txt",
                content,
            );
            assert.throws(
                () => materialize(source, root),
                /Secret-shaped|Private or local/,
                name,
            );
        });
    }
});

test("rejects payload content that is not valid UTF-8", () => {
    withTemporaryDirectory((root) => {
        const source = copyFixture(root);
        writeSourceFile(
            source,
            "skills/cratis-example/assets/example.txt",
            Buffer.from([0xc3, 0x28]),
        );
        assert.throws(
            () => materialize(source, root),
            /Invalid UTF-8 payload/,
        );
    });
});

test("recursive discovery exposes the engineering skills fixture and public validation refuses it", () => {
    assert.deepEqual(discoverSkillPaths(engineeringFixture), [
        "engineering/skills/cratis-engineering-example/SKILL.md",
    ]);
    assert.throws(
        () => validateStagedArtifact(engineeringFixture),
        /Forbidden artifact category|non-public skill paths/,
    );
});

test("archive extraction rejects invalid JSON", () => {
    withTemporaryDirectory((root) => {
        const archivePath = join(root, "invalid-archive.json");
        writeFileSync(archivePath, "{not-json");
        assert.throws(
            () => unpackFixtureArchive(archivePath, join(root, "unpacked")),
            /must be valid JSON/,
        );
    });
});

test("archive packing preflights limits and leaves no partial output", () => {
    withTemporaryDirectory((root) => {
        materialize(copyFixture(root), root);
        const archivePath = join(root, "fixture-archive.json");
        assert.throws(
            () =>
                packFixtureArchive(join(root, "stage"), archivePath, {
                    maximumEntries: 1,
                }),
            /entry-count policy/,
        );
        assert.equal(existsSync(archivePath), false);
        assert.equal(existsSync(`${archivePath}.partial`), false);
    });
});

test("archive extraction enforces archive, entry-count, encoded, and total-size bounds", () => {
    withTemporaryDirectory((root) => {
        materialize(copyFixture(root), root);
        const archivePath = join(root, "fixture-archive.json");
        packFixtureArchive(join(root, "stage"), archivePath);
        const original = JSON.parse(readFileSync(archivePath, "utf8"));

        assert.throws(
            () =>
                unpackFixtureArchive(archivePath, join(root, "entry-count"), {
                    maximumEntries: original.entries.length - 1,
                }),
            /entry-count policy/,
        );
        assert.throws(
            () =>
                unpackFixtureArchive(archivePath, join(root, "total-size"), {
                    maximumTotalSize: 1,
                }),
            /total-size policy/,
        );

        const encoded = structuredClone(original);
        encoded.entries[0].content += "AAAA";
        const encodedPath = join(root, "encoded.json");
        writeFileSync(encodedPath, JSON.stringify(encoded));
        assert.throws(
            () => unpackFixtureArchive(encodedPath, join(root, "encoded")),
            /encoded content exceeds declared size/,
        );

        const oversizedPath = join(root, "oversized-archive.json");
        writeFileSync(oversizedPath, JSON.stringify(original));
        assert.throws(
            () =>
                unpackFixtureArchive(
                    oversizedPath,
                    join(root, "oversized-archive"),
                    { maximumArchiveSize: 32 },
                ),
            /archive-size policy/,
        );
    });
});

test("archive validation failure leaves no partial destination", () => {
    withTemporaryDirectory((root) => {
        materialize(copyFixture(root), root);
        const archivePath = join(root, "fixture-archive.json");
        packFixtureArchive(join(root, "stage"), archivePath);
        const archive = JSON.parse(readFileSync(archivePath, "utf8"));
        archive.entries.at(-1).sha256 = "0".repeat(64);
        writeFileSync(archivePath, JSON.stringify(archive));
        const destination = join(root, "unpacked");
        assert.throws(
            () => unpackFixtureArchive(archivePath, destination),
            /digest or size mismatch/,
        );
        assert.equal(existsSync(destination), false);
    });
});

test("archive extraction rejects traversal, duplicate paths, digest tampering, and oversized entries", () => {
    withTemporaryDirectory((root) => {
        materialize(copyFixture(root), root);
        const archivePath = join(root, "fixture-archive.json");
        packFixtureArchive(join(root, "stage"), archivePath);
        const original = JSON.parse(readFileSync(archivePath, "utf8"));

        const cases = [
            [
                "traversal",
                (archive) => {
                    archive.entries[0].path = "../escape";
                },
                /traversal/,
            ],
            [
                "duplicate",
                (archive) => {
                    archive.entries.push(structuredClone(archive.entries[0]));
                },
                /duplicate path/,
            ],
            [
                "digest",
                (archive) => {
                    archive.entries[0].sha256 = "0".repeat(64);
                },
                /digest or size mismatch/,
            ],
            [
                "oversized",
                (archive) => {
                    archive.entries[0].size = 2_000_000;
                },
                /exceeds size policy/,
            ],
        ];

        for (const [name, mutate, expected] of cases) {
            const archive = structuredClone(original);
            mutate(archive);
            const path = join(root, `${name}.json`);
            writeFileSync(path, JSON.stringify(archive));
            assert.throws(
                () => unpackFixtureArchive(path, join(root, `unpack-${name}`)),
                expected,
            );
        }
    });
});
