// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { gradeIteration } from "../grade-navigator-runs.mjs";
import {
    renderCanonicalSummaryMarkdown,
    summarizeCanonicalRuns,
    validatePersistedCanonicalEvidence,
} from "../summarize-navigator-runs.mjs";
import {
    containsLocalPath,
    readNavigatorCases,
    readNavigatorHeldOut,
    validateNavigatorPilot,
} from "../navigator-pilot-validation.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function withRepositoryFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-navigator-"));
    try {
        for (const path of ["catalog", "evals", "pilots"])
            cpSync(join(repositoryRoot, path), join(root, path), {
                recursive: true,
            });
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("navigator pilot contract and canonical cases pass", () => {
    assert.deepEqual(validateNavigatorPilot(), []);
    const cases = readNavigatorCases();
    assert.equal(cases.length, 28);
    assert.equal(cases.filter((testCase) => testCase.kind === "positive").length, 12);
    assert.equal(cases.filter((testCase) => testCase.kind === "negative").length, 16);
    const heldOut = readNavigatorHeldOut();
    assert.equal(heldOut.length, 10);
    assert.equal(
        new Set([...cases, ...heldOut].map((testCase) => testCase.prompt)).size,
        38,
    );
});

test("navigator pilot cannot claim runtime or effects", () => {
    withRepositoryFixture((root) => {
        const path = join(root, "pilots/cratis-navigator/metadata.draft.json");
        const metadata = JSON.parse(readFileSync(path, "utf8"));
        metadata.runtimeEligible = true;
        metadata.repositoryWritesAllowed = true;
        writeFileSync(path, JSON.stringify(metadata));
        const errors = validateNavigatorPilot(root);
        assert(errors.some((error) => error.includes("absent from runtime")));
        assert(errors.some((error) => error.includes("effect-free")));
    });
});

test("navigator pilot routes cannot invent evidence or approval", () => {
    withRepositoryFixture((root) => {
        const path = join(root, "pilots/cratis-navigator/routes.draft.json");
        const routes = JSON.parse(readFileSync(path, "utf8"));
        routes.routes[0].evidenceState = "verified";
        routes.routes[0].evidenceRefs = ["invented"];
        routes.routes[0].approvalState = "approved";
        writeFileSync(path, JSON.stringify(routes));
        const errors = validateNavigatorPilot(root);
        assert(errors.some((error) => error.includes("cannot claim evidence")));
        assert(errors.some((error) => error.includes("cannot claim approval")));
    });
});

test("navigator malformed assertion collections fail without throwing", () => {
    withRepositoryFixture((root) => {
        const path = join(root, "evals/cratis-navigator/assertions.json");
        const assertions = JSON.parse(readFileSync(path, "utf8"));
        assertions.decisions = {};
        assertions.evidenceStates = 42;
        writeFileSync(path, JSON.stringify(assertions));
        let errors;
        assert.doesNotThrow(() => {
            errors = validateNavigatorPilot(root);
        });
        assert(errors.some((error) => error.includes("unknown decision")));
        assert(errors.some((error) => error.includes("unknown evidence state")));
    });
});

test("navigator pilot cases fail on extra output or performed invocation", () => {
    withRepositoryFixture((root) => {
        const path = join(root, "evals/cratis-navigator/cases.jsonl");
        const cases = readNavigatorCases(root);
        cases[0].expected.unexpected = true;
        cases[0].expected.invocationPerformed = true;
        writeFileSync(path, `${cases.map((value) => JSON.stringify(value)).join("\n")}\n`);
        const errors = validateNavigatorPilot(root);
        assert(errors.some((error) => error.includes("unknown property unexpected")));
        assert(errors.some((error) => error.includes("cannot perform invocation")));
    });
});

test("navigator tracer evidence records decision improvement without false promotion", () => {
    const grading = gradeIteration(
        join(repositoryRoot, "evals/cratis-navigator/runs/iteration-1"),
    );
    assert.equal(grading.summary.pilot.decisionMatches, 3);
    assert.equal(grading.summary.baseline.decisionMatches, 0);
    assert.equal(grading.summary.pilot.structurallyValid, 3);
    assert.equal(grading.summary.baseline.structurallyValid, 0);
    assert.equal(grading.summary.pilot.exactMatches, 0);
    assert.equal(
        grading.summary.pilot.observedOutputSafetyViolations,
        0,
    );
});

test("navigator held-out pass reports strict and contract results while promotion remains blocked", () => {
    const grading = gradeIteration(
        join(
            repositoryRoot,
            "evals/cratis-navigator/held-out-runs/pass-1",
        ),
    );
    assert.equal(grading.summary.pilot.runs, 10);
    assert.equal(grading.summary.pilot.exactMatches, 8);
    assert.equal(grading.summary.pilot.contractMatches, 10);
    assert.equal(grading.summary.pilot.structurallyValid, 10);
    assert.equal(
        grading.summary.pilot.observedOutputSafetyViolations,
        0,
    );
    assert.equal(grading.summary.baseline.exactMatches, 0);
    const h05 = grading.results.find(
        (result) => result.caseId === "H05" && result.condition === "pilot",
    );
    assert.equal(h05.exactMatch, false);
    assert.equal(h05.contractMatch, true);
    assert.deepEqual(h05.mismatches, ["clarification"]);
    assert.deepEqual(h05.contractMismatches, []);
    const persisted = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "evals/cratis-navigator/held-out-runs/pass-1/grading.json",
            ),
            "utf8",
        ),
    );
    assert.deepEqual(persisted, grading);
});

test("navigator local-path detection covers Unix and Windows forms", () => {
    for (const localPath of [
        "/Users/example/project",
        "/uSeRs/example/project",
        "/home",
        "/HOME",
        "/home/example/project",
        "/HOME/example/project",
        "/Volumes",
        "/vOlUmEs",
        "/Volumes/example/project",
        "/vOlUmEs/example/project",
        "/root",
        "/RoOt/example/project",
        String.raw`/\u0052oot/private`,
        String.raw`/\u0056olumes/private`,
        String.raw`/\u0055sers/private`,
        "C:/Users",
        "d:/USERS",
        "C:/Users/example/project",
        "d:/USERS/example/project",
        "D:/src/project",
        "/workspace/project",
        "/tmp/project",
        "/etc/passwd",
        "/",
        "path=/root/private",
        "`/workspace/private`",
        "/数据/project",
        "///root/private",
        "<repository-root>/safe:/etc/passwd",
        "<repository-root>/safe;/etc/passwd",
        "<repository-root>/safe|/etc/passwd",
        "https://example.test/path|/root/private",
        "https://example.test/path|C:/private",
        "https://example.test:/root/private",
        "https://example.test/path]/root/private",
        "https://example.test/path;/root/private",
        "https://example.test/path,/root/private",
        "https://example.test/path)/root/private",
        "https://example.test/path[segment;/root/private",
        "https://example.test?[segment|/root/private",
        "https://example.test#[segment;/root/private",
        "https://[host;/root/private",
        "https://[host|C:/private",
        "https://[::1][host;/root/private",
        "https://[::1][host|C:/private",
        String.raw`https://[broken|C:\private[::1]`,
        String.raw`https://[::1|C:\private][broken`,
        "https://[host/path;/root/private",
        "https:///root/private",
        "#/client/route;/etc/passwd",
        "#/client/route|C:/private",
        "#/client/route[segment|/tmp/private",
        "//cdn.example.test/assets|/tmp/private",
        "C:/",
        String.raw`\\server\share\project`,
        String.raw`E:\\Users\\example\\project`,
        String.raw`F:\Users\example\project`,
    ])
        assert.equal(containsLocalPath(localPath), true, localPath);
    assert.equal(containsLocalPath("docs/Users-guide.md"), false);
    assert.equal(
        containsLocalPath("<repository-root>/.agents/skills/example/SKILL.md"),
        false,
    );
    assert.equal(
        containsLocalPath(String.raw`<repository-root>\.agents\PROJECT.md`),
        false,
    );
    for (const remoteUrl of [
        "https://example.test/path?next=/root/private#/route",
        "https://example.test?next=/remote/path",
        "https://example.test#fragment/route",
        "https://example.test/path;a,b)c",
        "https://example.test:8080/path",
        "https://example.test/api/v1:/status",
        "https://[::1]/path",
        "wss://example.test/socket/path",
        "//cdn.example.test/assets/app.js",
        "//user:pass@localhost/assets/app.js",
        "//localhost/assets/app.js",
        "#/client/route",
        "#/client/route;a,b)c",
    ])
        assert.equal(containsLocalPath(remoteUrl), false, remoteUrl);
});

test("navigator missing roots and symlinked evidence fail without throwing", () => {
    withRepositoryFixture((root) => {
        rmSync(join(root, "pilots/cratis-navigator"), {
            recursive: true,
            force: true,
        });
        let errors;
        assert.doesNotThrow(() => {
            errors = validateNavigatorPilot(root);
        });
        assert(
            errors.some((error) =>
                error.includes("navigator metadata: expected a regular file"),
            ),
        );
        assert(
            errors.some((error) =>
                error.includes("Navigator pilot inventory: expected a directory"),
            ),
        );
    });
    withRepositoryFixture((root) => {
        const pilotRoot = join(root, "pilots/cratis-navigator");
        unlinkSync(join(pilotRoot, "PILOT.md"));
        symlinkSync("metadata.draft.json", join(pilotRoot, "PILOT.md"));
        const evaluationRoot = join(root, "evals/cratis-navigator");
        unlinkSync(join(evaluationRoot, "baseline.md"));
        mkdirSync(join(evaluationRoot, "baseline.md"));
        const runsRoot = join(evaluationRoot, "runs");
        unlinkSync(join(runsRoot, "canonical-selection.json"));
        symlinkSync(
            "canonical-summary.json",
            join(runsRoot, "canonical-selection.json"),
        );
        symlinkSync("coverage-1", join(runsRoot, "linked-iteration"));
        const heldOutPath = join(evaluationRoot, "held-out.jsonl");
        unlinkSync(heldOutPath);
        symlinkSync("cases.jsonl", heldOutPath);
        const heldOutRunsRoot = join(evaluationRoot, "held-out-runs");
        rmSync(join(heldOutRunsRoot, "pass-1"), {
            recursive: true,
            force: true,
        });
        symlinkSync("../runs", join(heldOutRunsRoot, "pass-1"));
        let errors;
        assert.doesNotThrow(() => {
            errors = validateNavigatorPilot(root);
        });
        assert(
            errors.some((error) =>
                error.includes("canonical selection: expected a regular file"),
            ),
        );
        assert(
            errors.some((error) =>
                error.includes("held-out corpus: expected a regular file"),
            ),
        );
        assert(
            errors.includes(
                "Navigator pilot inventory must contain regular files only",
            ),
        );
        assert(errors.includes("Navigator evaluation inventory types changed"));
        assert(errors.includes("Navigator held-out pass inventory changed"));
        assert(
            errors.includes("Navigator run inventory contains a non-regular entry"),
        );
        assert(
            validatePersistedCanonicalEvidence(root).some((error) =>
                error.includes("navigator run inventory entry is not regular"),
            ),
        );
        assert.throws(() =>
            gradeIteration(join(runsRoot, "linked-iteration"), root),
        );
        assert.throws(() =>
            gradeIteration(join(heldOutRunsRoot, "pass-1"), root),
        );
    });
});

test("navigator syntactically valid null roots fail without throwing", () => {
    withRepositoryFixture((root) => {
        for (const path of [
            "pilots/cratis-navigator/metadata.draft.json",
            "pilots/cratis-navigator/routes.draft.json",
            "evals/cratis-navigator/assertions.json",
            "catalog/v2/targets.json",
            "catalog/v2/authoring-contracts.json",
        ])
            writeFileSync(join(root, path), "null");
        let errors;
        assert.doesNotThrow(() => {
            errors = validateNavigatorPilot(root);
        });
        assert(
            errors.filter((error) => error.includes("expected a JSON object"))
                .length >= 5,
        );
    });
});

test("navigator malformed JSON cannot abort validation or recomputation", () => {
    withRepositoryFixture((root) => {
        const casesPath = join(root, "evals/cratis-navigator/cases.jsonl");
        const validCases = readFileSync(casesPath, "utf8");
        writeFileSync(casesPath, `{\n${validCases}`);
        writeFileSync(
            join(root, "evals/cratis-navigator/runs/canonical-summary.json"),
            "{",
        );
        writeFileSync(
            join(root, "evals/cratis-navigator/runs/iteration-1/metadata.json"),
            "{",
        );
        writeFileSync(
            join(
                root,
                "evals/cratis-navigator/held-out-runs/pass-1/H01/pilot.json",
            ),
            "{",
        );
        let validationErrors;
        assert.doesNotThrow(() => {
            validationErrors = validateNavigatorPilot(root);
        });
        assert(
            validationErrors.some((error) => error.includes("invalid JSON")),
        );
        let persistedErrors;
        assert.doesNotThrow(() => {
            persistedErrors = validatePersistedCanonicalEvidence(root);
        });
        assert(
            persistedErrors.some((error) =>
                error.includes("canonical summary JSON is invalid"),
            ),
        );
    });
});

test("navigator malformed corpus records fail without aborting validation", () => {
    withRepositoryFixture((root) => {
        const casesPath = join(root, "evals/cratis-navigator/cases.jsonl");
        const caseLines = readFileSync(casesPath, "utf8").trim().split("\n");
        caseLines[0] = "null";
        const malformedCase = JSON.parse(caseLines[1]);
        malformedCase.expected = null;
        caseLines[1] = JSON.stringify(malformedCase);
        writeFileSync(casesPath, `${caseLines.join("\n")}\n`);
        const heldOutPath = join(root, "evals/cratis-navigator/held-out.jsonl");
        const heldOutLines = readFileSync(heldOutPath, "utf8").trim().split("\n");
        heldOutLines[0] = "null";
        writeFileSync(heldOutPath, `${heldOutLines.join("\n")}\n`);
        const linkedOutputPath = join(
            root,
            "evals/cratis-navigator/runs/coverage-1/N07/pilot.json",
        );
        const linkedOutput = JSON.parse(readFileSync(linkedOutputPath, "utf8"));
        linkedOutput.projectContextRefs = ["/tmp/corpus-linked-leak"];
        writeFileSync(linkedOutputPath, JSON.stringify(linkedOutput));
        let errors;
        assert.doesNotThrow(() => {
            errors = validateNavigatorPilot(root);
        });
        assert(errors.includes("Navigator case must be a plain object"));
        assert(
            errors.some((error) =>
                error.includes("expected output must be a plain object"),
            ),
        );
        assert(errors.includes("coverage-1: local absolute path leaked"));
    });
});

test("navigator missing and unexpected outputs preserve sibling validation", () => {
    withRepositoryFixture((root) => {
        const coverageRoot = join(
            root,
            "evals/cratis-navigator/runs/coverage-1",
        );
        unlinkSync(join(coverageRoot, "N07/pilot.json"));
        mkdirSync(join(coverageRoot, "UNKNOWN"));
        writeFileSync(join(coverageRoot, "UNKNOWN/pilot.json"), "not json");
        symlinkSync("N07", join(coverageRoot, "linked-case"));
        const h01Root = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/H01",
        );
        mkdirSync(join(h01Root, "unexpected"));
        writeFileSync(join(h01Root, "unexpected.txt"), "not json");
        const passRoot = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1",
        );
        const h02Root = join(passRoot, "H02");
        unlinkSync(join(h02Root, "baseline.json"));
        mkdirSync(join(passRoot, "H99"));
        writeFileSync(join(passRoot, "H99/pilot.json"), "not json");
        symlinkSync("H01", join(passRoot, "linked-case"));
        let errors;
        assert.doesNotThrow(() => {
            errors = validateNavigatorPilot(root);
        });
        assert(errors.includes("coverage-1/N07: missing pilot output"));
        assert(errors.includes("coverage-1: unknown run case UNKNOWN"));
        assert(
            errors.includes(
                "coverage-1: run inventory contains a non-regular entry",
            ),
        );
        assert(
            validatePersistedCanonicalEvidence(root).some((error) =>
                error.includes("iteration contains a non-regular entry"),
            ),
        );
        assert(errors.includes("pass-1/H01: held-out outputs changed"));
        assert(errors.includes("pass-1/H02: missing baseline.json"));
        assert(errors.includes("pass-1: held-out cases are incomplete"));
        assert(
            errors.includes(
                "pass-1: held-out inventory contains a non-regular entry",
            ),
        );
    });
});

test("navigator case-directory special entries fail recomputation", () => {
    withRepositoryFixture((root) => {
        const caseRoot = join(
            root,
            "evals/cratis-navigator/runs/coverage-1/N07",
        );
        symlinkSync("baseline.json", join(caseRoot, "linked-output"));
        const validationErrors = validateNavigatorPilot(root);
        assert(validationErrors.includes("coverage-1/N07: run outputs changed"));
        assert(
            validatePersistedCanonicalEvidence(root).some((error) =>
                error.includes("run case inventory changed"),
            ),
        );
    });
    withRepositoryFixture((root) => {
        const iterationRoot = join(
            root,
            "evals/cratis-navigator/runs/coverage-1",
        );
        rmSync(join(iterationRoot, "N07"), { recursive: true, force: true });
        assert.throws(() => gradeIteration(iterationRoot, root));
        assert(
            validatePersistedCanonicalEvidence(root).some((error) =>
                error.includes("run case inventory is incomplete"),
            ),
        );
    });
});

test("navigator canonical evidence is null-safe, exact, and scans analysis", () => {
    withRepositoryFixture((root) => {
        const summaryPath = join(
            root,
            "evals/cratis-navigator/runs/canonical-summary.json",
        );
        const metadataPath = join(
            root,
            "evals/cratis-navigator/runs/iteration-1/metadata.json",
        );
        const gradingPath = join(
            root,
            "evals/cratis-navigator/runs/iteration-1/grading.json",
        );
        const analysisPath = join(
            root,
            "evals/cratis-navigator/runs/iteration-1/analysis.md",
        );
        writeFileSync(summaryPath, "null");
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        metadata.runs[0] = null;
        metadata.unexpected = true;
        writeFileSync(metadataPath, JSON.stringify(metadata));
        const grading = JSON.parse(readFileSync(gradingPath, "utf8"));
        grading.results[0] = null;
        grading.safetyEvidence = 42;
        writeFileSync(gradingPath, JSON.stringify(grading));
        writeFileSync(analysisPath, "Evidence from /RoOt/private/project\n");
        let errors;
        assert.doesNotThrow(() => {
            errors = validateNavigatorPilot(root);
        });
        assert(errors.includes("navigator canonical summary: expected a JSON object"));
        assert(errors.includes("iteration-1 metadata: unknown property unexpected"));
        assert(errors.includes("iteration-1 run: must be a plain object"));
        assert(errors.includes("iteration-1 grading result: must be a plain object"));
        assert(errors.includes("iteration-1 safety evidence: must be a plain object"));
        assert(errors.includes("iteration-1: local absolute path leaked"));
    });
});

test("navigator canonical JSON rejects Unicode-escaped local paths", () => {
    withRepositoryFixture((root) => {
        const metadataPath = join(
            root,
            "evals/cratis-navigator/runs/iteration-1/metadata.json",
        );
        const content = readFileSync(metadataPath, "utf8").replace(
            /"model":\s*"[^"]+"/,
            String.raw`"model": "/\u0052oot/private"`,
        );
        writeFileSync(metadataPath, content);
        const errors = validateNavigatorPilot(root);
        assert(errors.includes("iteration-1: local absolute path leaked"));
    });
});

test("navigator canonical recomputation reports malformed selections and outputs", () => {
    withRepositoryFixture((root) => {
        const selectionPath = join(
            root,
            "evals/cratis-navigator/runs/canonical-selection.json",
        );
        const selection = JSON.parse(readFileSync(selectionPath, "utf8"));
        selection.catalogRevision = "0".repeat(40);
        selection.selectedRuns.P01 = null;
        selection.selectedRuns.P02 = "../outside";
        writeFileSync(selectionPath, JSON.stringify(selection));
        writeFileSync(
            join(
                root,
                "evals/cratis-navigator/runs/coverage-3/P01/pilot.json",
            ),
            "null",
        );
        const validationErrors = validateNavigatorPilot(root);
        assert(
            validationErrors.includes("Navigator canonical selection is incomplete"),
        );
        let errors;
        assert.doesNotThrow(() => {
            errors = validatePersistedCanonicalEvidence(root);
        });
        assert(
            errors.some((error) =>
                error.includes("canonical recomputation failed"),
            ),
        );
        assert(
            errors.some((error) =>
                error.includes("coverage-3: persisted navigator grading cannot be recomputed"),
            ),
        );
    });
});

test("navigator selected runs remain catalog-revision bound", () => {
    withRepositoryFixture((root) => {
        const runsRoot = join(root, "evals/cratis-navigator/runs");
        unlinkSync(join(runsRoot, "canonical-summary.json"));
        const runRoot = join(runsRoot, "coverage-3");
        const metadataPath = join(runRoot, "metadata.json");
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        metadata.pilotCatalogRevision = "0".repeat(40);
        writeFileSync(metadataPath, JSON.stringify(metadata));
        const gradingPath = join(runRoot, "grading.json");
        const grading = JSON.parse(readFileSync(gradingPath, "utf8"));
        grading.catalogRevision = "0".repeat(40);
        writeFileSync(gradingPath, JSON.stringify(grading));
        const errors = validateNavigatorPilot(root);
        assert(errors.includes("coverage-3: selected metadata revision changed"));
        assert(errors.includes("coverage-3: selected grading revision changed"));
        assert(
            validatePersistedCanonicalEvidence(root).some((error) =>
                error.includes("canonical recomputation failed"),
            ),
        );
    });
});

test("navigator missing canonical files cannot suppress sibling checks", () => {
    withRepositoryFixture((root) => {
        const runsRoot = join(root, "evals/cratis-navigator/runs");
        unlinkSync(join(runsRoot, "canonical-selection.json"));
        mkdirSync(join(runsRoot, "canonical-selection.json"));
        writeFileSync(join(runsRoot, "canonical-summary.json"), "null");
        const iterationRoot = join(runsRoot, "iteration-1");
        unlinkSync(join(iterationRoot, "metadata.json"));
        const gradingPath = join(iterationRoot, "grading.json");
        const grading = JSON.parse(readFileSync(gradingPath, "utf8"));
        grading.safetyEvidence = null;
        writeFileSync(gradingPath, JSON.stringify(grading));
        writeFileSync(
            join(iterationRoot, "analysis.md"),
            "Evidence from /ROOT/private\n",
        );
        let errors;
        assert.doesNotThrow(() => {
            errors = validateNavigatorPilot(root);
        });
        assert(errors.includes("navigator canonical summary: expected a JSON object"));
        assert(errors.includes("iteration-1 safety evidence: must be a plain object"));
        assert(errors.includes("iteration-1: local absolute path leaked"));
    });
});

test("navigator held-out redactions and output roots fail closed", () => {
    withRepositoryFixture((root) => {
        const metadataPath = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/metadata.json",
        );
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        metadata.redactions[0] = null;
        writeFileSync(metadataPath, JSON.stringify(metadata));
        writeFileSync(
            join(
                root,
                "evals/cratis-navigator/held-out-runs/pass-1/H01/pilot.json",
            ),
            "null",
        );
        let errors;
        assert.doesNotThrow(() => {
            errors = validateNavigatorPilot(root);
        });
        assert(errors.includes("pass-1 redaction: must be a plain object"));
        assert(
            errors.includes(
                "pass-1/H01/pilot.json output: expected a JSON object",
            ),
        );
    });
});

test("navigator held-out evidence rejects missing required fields", () => {
    withRepositoryFixture((root) => {
        const metadataPath = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/metadata.json",
        );
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        delete metadata.model;
        delete metadata.runs[0].agentId;
        metadata.runs[1] = null;
        writeFileSync(metadataPath, JSON.stringify(metadata));
        const gradingPath = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/grading.json",
        );
        const grading = JSON.parse(readFileSync(gradingPath, "utf8"));
        delete grading.catalogRevision;
        grading.safetyEvidence = null;
        grading.summary.pilot = 42;
        delete grading.summary.baseline.contractMatches;
        delete grading.results[0].exactMatch;
        grading.results[1] = null;
        writeFileSync(gradingPath, JSON.stringify(grading));
        const errors = validateNavigatorPilot(root);
        for (const label of [
            "pass-1 metadata: required fields are incomplete",
            "pass-1 run: required fields are incomplete",
            "pass-1 run: must be a plain object",
            "pass-1 grading: required fields are incomplete",
            "pass-1 grading result: required fields are incomplete",
            "pass-1 grading result: must be a plain object",
            "pass-1 safety evidence: must be a plain object",
            "pass-1 pilot summary: must be a plain object",
            "pass-1 baseline summary: required fields are incomplete",
        ])
            assert(errors.includes(label), label);
    });
});

test("navigator held-out root corruption cannot skip sibling validation", () => {
    withRepositoryFixture((root) => {
        const metadataPath = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/metadata.json",
        );
        const gradingPath = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/grading.json",
        );
        writeFileSync(metadataPath, "null");
        const grading = JSON.parse(readFileSync(gradingPath, "utf8"));
        grading.safetyEvidence = null;
        writeFileSync(gradingPath, JSON.stringify(grading));
        const errors = validateNavigatorPilot(root);
        assert(errors.includes("pass-1 metadata: expected a JSON object"));
        assert(errors.includes("pass-1 safety evidence: must be a plain object"));
    });
    withRepositoryFixture((root) => {
        const metadataPath = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/metadata.json",
        );
        const gradingPath = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/grading.json",
        );
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        metadata.runs[0] = null;
        writeFileSync(metadataPath, JSON.stringify(metadata));
        writeFileSync(gradingPath, "null");
        const errors = validateNavigatorPilot(root);
        assert(errors.includes("pass-1 run: must be a plain object"));
        assert(errors.includes("pass-1 grading: expected a JSON object"));
    });
});

test("navigator held-out corpus remains byte-bound to the freeze commit", () => {
    withRepositoryFixture((root) => {
        const path = join(root, "evals/cratis-navigator/held-out.jsonl");
        const heldOut = readNavigatorHeldOut(root);
        heldOut[1].prompt = heldOut[0].prompt;
        writeFileSync(
            path,
            `${heldOut.map((value) => JSON.stringify(value)).join("\n")}\n`,
        );
        const errors = validateNavigatorPilot(root);
        assert(
            errors.some((error) =>
                error.includes("Duplicate navigator held-out prompt"),
            ),
        );
        assert(
            errors.some((error) =>
                error.includes("held-out corpus differs from its freeze binding"),
            ),
        );
    });
});

test("navigator held-out evidence rejects duplicate metadata and home paths", () => {
    withRepositoryFixture((root) => {
        const metadataPath = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/metadata.json",
        );
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        metadata.runs.push(structuredClone(metadata.runs[0]));
        writeFileSync(metadataPath, JSON.stringify(metadata));
        const outputPath = join(
            root,
            "evals/cratis-navigator/held-out-runs/pass-1/H01/pilot.json",
        );
        const output = JSON.parse(readFileSync(outputPath, "utf8"));
        output.projectContextRefs = ["/home/example/project"];
        writeFileSync(outputPath, JSON.stringify(output));
        const errors = validateNavigatorPilot(root);
        assert(
            errors.some((error) =>
                error.includes("held-out metadata is incomplete"),
            ),
        );
        assert(
            errors.some((error) => error.includes("held-out local path leaked")),
        );
    });
});

test("navigator canonical summary covers every case while promotion remains blocked", () => {
    const summary = summarizeCanonicalRuns();
    assert.equal(summary.summary.pilot.runs, 28);
    assert.equal(summary.summary.pilot.exactMatches, 26);
    assert.equal(summary.summary.pilot.contractMatches, 28);
    assert.equal(summary.summary.pilot.structurallyValid, 28);
    assert.equal(
        summary.summary.pilot.observedOutputSafetyViolations,
        0,
    );
    assert.equal(summary.summary.baseline.exactMatches, 0);
    assert.equal(summary.summary.baseline.structurallyValid, 0);
    assert.equal(summary.promotionState, "blocked");
    assert(
        summary.promotionBlockers.includes(
            "canonical strict exactness threshold is not met",
        ),
    );
    assert(summary.promotionBlockers.includes("effect telemetry is absent"));
    const persistedSummary = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "evals/cratis-navigator/runs/canonical-summary.json",
            ),
            "utf8",
        ),
    );
    assert.deepEqual(persistedSummary, summary);
    assert.equal(
        readFileSync(
            join(
                repositoryRoot,
                "evals/cratis-navigator/runs/canonical-summary.md",
            ),
            "utf8",
        ),
        renderCanonicalSummaryMarkdown(summary),
    );
    assert.deepEqual(validatePersistedCanonicalEvidence(), []);
});

test("navigator persisted canonical evidence rejects grading and summary drift", () => {
    withRepositoryFixture((root) => {
        const summaryPath = join(
            root,
            "evals/cratis-navigator/runs/canonical-summary.json",
        );
        const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
        summary.summary.pilot.exactMatches = 28;
        writeFileSync(summaryPath, JSON.stringify(summary));
        writeFileSync(
            join(root, "evals/cratis-navigator/runs/canonical-summary.md"),
            "stale\n",
        );
        const gradingPath = join(
            root,
            "evals/cratis-navigator/runs/iteration-1/grading.json",
        );
        const grading = JSON.parse(readFileSync(gradingPath, "utf8"));
        grading.summary.pilot.exactMatches = 3;
        writeFileSync(gradingPath, JSON.stringify(grading));
        const errors = validatePersistedCanonicalEvidence(root);
        assert(
            errors.includes("Persisted navigator canonical summary JSON is stale"),
        );
        assert(
            errors.includes(
                "Persisted navigator canonical summary Markdown is stale",
            ),
        );
        assert(
            errors.includes(
                "iteration-1: persisted navigator grading is stale",
            ),
        );
    });
});

test("navigator pilot cases preserve evidence precedence and lexical abstention", () => {
    const cases = new Map(readNavigatorCases().map((testCase) => [testCase.id, testCase]));
    assert.equal(cases.get("P07").expected.decision, "BLOCKED_UNVERIFIED");
    assert.equal(cases.get("P07").expected.requestedEffect, "passive");
    for (const id of ["N01", "N02", "N03", "N04", "N05", "N06", "N07", "N08"])
        assert.equal(cases.get(id).expected.decision, "ABSTAIN");
    assert.equal(cases.get("N14").expected.decision, "REFUSE");
    assert.equal(cases.get("N16").expected.decision, "REFUSE");
});
