// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from "node:assert/strict";
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
    readDiagnosticsCases,
    validateDiagnosticsPilot,
    validateDiagnosticsResult,
} from "../diagnostics-pilot-validation.mjs";

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
);

function validHandoffResult() {
    return {
        schemaVersion: "cratis-slice-diagnostics-v1",
        evaluationOnly: true,
        runtimeApproved: false,
        caseId: "P09",
        sourceBinding: {
            repositoryRevision: "fixture-revision",
            authorityContractRevision: "not-required",
            evidenceBundleDigest: "fixture-digest",
        },
        profile: { value: "unknown", status: "UNVERIFIED", evidenceRefs: [] },
        lane: "chronicle-live-state",
        disposition: "HANDOFF",
        reasonCode: "LIVE_STATE_REQUIRED",
        symptom: {
            verbatimRedacted: "A current partition is reported as failing.",
            expected: "The partition state is known.",
            observed: "No runtime evidence was supplied.",
            preconditions: [],
            frequency: "unknown",
            environmentBoundary: "unsupplied live environment",
            reproductionSteps: [],
            reproductionState: "not-reproduced",
            evidenceRefs: [],
        },
        facts: [],
        hypotheses: [],
        instrumentationRequests: [],
        proof: {
            userVisibleRegressionProven: false,
            causalDiagnosisSupported: false,
            fixProven: false,
            failingArtifactRefs: [],
            passingArtifactRefs: [],
            correctionRefs: [],
            regressionAssertionRefs: [],
            cleanupProofRefs: [],
        },
        handoffs: ["chronicle-live-state"],
        blocked: [],
        skipped: [],
        inconclusive: [],
        redactions: [],
        cleanup: {
            required: false,
            status: "NOT_APPLICABLE",
            instrumentationIds: [],
            removalProofRefs: [],
        },
        execution: {
            performed: false,
            commands: [],
            networkAccess: false,
            runtimeAccess: false,
            repositoryWrites: false,
            remoteWrites: false,
            mutations: false,
            approvalsChanged: false,
            publicationPerformed: false,
            instrumentationApplied: false,
            targetRefs: [],
        },
        conclusion: "Current runtime evidence is required for passive handoff.",
        limitations: ["NO_LIVE_EVIDENCE"],
    };
}

function validInstrumentationResult() {
    const result = validHandoffResult();
    result.caseId = "P08";
    result.profile = {
        value: "application",
        status: "VERIFIED",
        evidenceRefs: ["profile-fixture"],
    };
    result.lane = "application-source";
    result.disposition = "INCONCLUSIVE";
    result.reasonCode = "TEMPORARY_INSTRUMENTATION_PENDING";
    result.handoffs = [];
    result.hypotheses = [
        {
            id: "H1",
            statement: "A bounded transition may be missing.",
            evidenceRefs: ["source-fixture"],
            productClaimRefs: ["authority-fixture"],
            predictedObservation: "The counter remains unchanged.",
            discriminatingEvidence: "One bounded counter observation.",
            supportsWhen: "The transition is absent.",
            rejectsWhen: "The transition is present.",
            status: "PROPOSED",
        },
    ];
    result.instrumentationRequests = [
        {
            id: "I1",
            hypothesisId: "H1",
            relativePath: "Source/Orders/Projection.cs",
            symbol: "OrderProjection",
            signal: "counter",
            allowedFields: ["eventType", "outcome"],
            forbiddenFields: [
                "authorization",
                "body",
                "connectionString",
                "cookie",
                "headers",
                "payload",
                "personalData",
                "secret",
                "token",
            ],
            maximumRecords: 8,
            redactionRule: "drop-unlisted-fields",
            removalTrigger: "after one bounded reproduction",
            cleanupSteps: ["Remove proposed instrumentation after reproduction."],
            cleanupVerification: "Verify the instrumentation identifier is absent.",
            applyAllowed: false,
            status: "PROPOSED",
        },
    ];
    result.cleanup = {
        required: true,
        status: "PENDING",
        instrumentationIds: ["I1"],
        removalProofRefs: [],
    };
    return result;
}

function enableFutureFixtures(metadata, ...caseIds) {
    const enabled = structuredClone(metadata);
    enabled.instrumentationRequestsEnabled = true;
    enabled.sourceDiagnosisEnabled = true;
    enabled.verifiedProfilesEnabled = true;
    enabled.enabledEvaluationCaseIds = [
        ...new Set([...enabled.enabledEvaluationCaseIds, ...caseIds]),
    ];
    return enabled;
}

function validFixedResult() {
    const result = validHandoffResult();
    result.caseId = "P01";
    result.profile = {
        value: "application",
        status: "VERIFIED",
        evidenceRefs: ["profile-fixture"],
    };
    result.lane = "application-source";
    result.disposition = "SOURCE_DIAGNOSIS";
    result.reasonCode = "SOURCE_CAUSE_SUPPORTED";
    result.handoffs = [];
    result.sourceBinding.repositoryRevision = "b".repeat(40);
    result.sourceBinding.authorityContractRevision = "c".repeat(40);
    result.sourceBinding.evidenceBundleDigest = "a".repeat(64);
    result.hypotheses = [
        {
            id: "H1",
            statement: "One cause survives bounded evidence.",
            evidenceRefs: ["failing-artifact"],
            productClaimRefs: ["authority-claim"],
            predictedObservation: "The failing artifact remains reproducible.",
            discriminatingEvidence: "The corrected artifact changes the result.",
            supportsWhen: "The failing artifact is present.",
            rejectsWhen: "The failing artifact is absent.",
            status: "SUPPORTED",
        },
        {
            id: "H2",
            statement: "An alternative does not survive bounded evidence.",
            evidenceRefs: ["rejection-artifact"],
            productClaimRefs: ["authority-claim"],
            predictedObservation: "The alternative prediction is absent.",
            discriminatingEvidence: "The failing artifact rejects the alternative.",
            supportsWhen: "The alternative prediction is present.",
            rejectsWhen: "The alternative prediction is absent.",
            status: "REJECTED",
        },
    ];
    result.proof = {
        userVisibleRegressionProven: true,
        causalDiagnosisSupported: true,
        fixProven: true,
        failingArtifactRefs: ["failing-artifact"],
        passingArtifactRefs: ["passing-artifact"],
        correctionRefs: ["correction"],
        regressionAssertionRefs: ["regression-assertion"],
        cleanupProofRefs: [`cleanup:removed-I1:${"d".repeat(64)}`],
    };
    result.cleanup = {
        required: true,
        status: "VERIFIED",
        instrumentationIds: ["removed-I1"],
        removalProofRefs: [`cleanup:removed-I1:${"d".repeat(64)}`],
    };
    return result;
}

function withFixture(callback) {
    const root = mkdtempSync(join(tmpdir(), "cratis-diagnostics-"));
    try {
        mkdirSync(join(root, "catalog/v2"), { recursive: true });
        mkdirSync(join(root, "evals"), { recursive: true });
        mkdirSync(join(root, "pilots"), { recursive: true });
        cpSync(
            join(repositoryRoot, "catalog/v2/authoring-contracts.json"),
            join(root, "catalog/v2/authoring-contracts.json"),
        );
        cpSync(
            join(repositoryRoot, "evals/application-slice-diagnostics"),
            join(root, "evals/application-slice-diagnostics"),
            { recursive: true },
        );
        cpSync(
            join(repositoryRoot, "pilots/application-slice-diagnostics"),
            join(root, "pilots/application-slice-diagnostics"),
            { recursive: true },
        );
        return callback(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("diagnostics pilot contract and canonical cases pass", () => {
    assert.deepEqual(validateDiagnosticsPilot(), []);
    const cases = readDiagnosticsCases();
    assert.equal(cases.length, 24);
    assert.equal(cases.filter((testCase) => testCase.kind === "positive").length, 10);
    assert.equal(cases.filter((testCase) => testCase.kind === "negative").length, 14);
    assert.equal(cases.filter((testCase) => testCase.enabled).length, 10);
    assert.equal(cases.filter((testCase) => !testCase.enabled).length, 14);
});

test("diagnostics pilot pins routes, assertions, and prompt corpus digests", () => {
    withFixture((root) => {
        const routesPath = join(
            root,
            "pilots/application-slice-diagnostics/symptom-routes.json",
        );
        const assertionsPath = join(
            root,
            "evals/application-slice-diagnostics/assertions.json",
        );
        const casesPath = join(
            root,
            "evals/application-slice-diagnostics/cases.jsonl",
        );
        const routes = JSON.parse(readFileSync(routesPath, "utf8"));
        routes.routes[0].signals = ["changed-signal"];
        writeFileSync(routesPath, JSON.stringify(routes));
        const assertions = JSON.parse(readFileSync(assertionsPath, "utf8"));
        assertions.globalAssertions = ["changed assertion"];
        writeFileSync(assertionsPath, JSON.stringify(assertions));
        const cases = readDiagnosticsCases(root);
        const firstPrompt = cases[0].prompt;
        cases[0].prompt = cases[1].prompt;
        cases[1].prompt = firstPrompt;
        writeFileSync(
            casesPath,
            `${cases.map((testCase) => JSON.stringify(testCase)).join("\n")}\n`,
        );
        const errors = validateDiagnosticsPilot(root);
        assert(errors.includes("Diagnostics routes digest changed"));
        assert(errors.includes("Diagnostics assertions digest changed"));
        assert(errors.includes("Diagnostics cases digest changed"));
    });
});

test("diagnostics pilot cannot claim runtime or effects", () => {
    withFixture((root) => {
        const path = join(
            root,
            "pilots/application-slice-diagnostics/metadata.draft.json",
        );
        const metadata = JSON.parse(readFileSync(path, "utf8"));
        metadata.runtimeEligible = true;
        metadata.networkAllowed = true;
        writeFileSync(path, JSON.stringify(metadata));
        const errors = validateDiagnosticsPilot(root);
        assert(errors.some((error) => error.includes("absent from runtime")));
        assert(errors.some((error) => error.includes("effect-free")));
    });
});

test("diagnostics pilot result contract cannot permit execution", () => {
    withFixture((root) => {
        const path = join(
            root,
            "pilots/application-slice-diagnostics/result-contract.json",
        );
        const contract = JSON.parse(readFileSync(path, "utf8"));
        contract.executionConstants.performed = true;
        contract.executionConstants.commands = ["replay"];
        writeFileSync(path, JSON.stringify(contract));
        assert(
            validateDiagnosticsPilot(root).some((error) =>
                error.includes("permits execution"),
            ),
        );
    });
});

test("diagnostics pilot malformed root documents fail without throwing", () => {
    withFixture((root) => {
        for (const path of [
            "pilots/application-slice-diagnostics/metadata.draft.json",
            "pilots/application-slice-diagnostics/symptom-routes.json",
            "pilots/application-slice-diagnostics/result-contract.json",
            "evals/application-slice-diagnostics/assertions.json",
        ])
            writeFileSync(join(root, path), "null");
        const casesPath = join(
            root,
            "evals/application-slice-diagnostics/cases.jsonl",
        );
        const cases = readDiagnosticsCases(root);
        cases[0] = null;
        writeFileSync(
            casesPath,
            `${cases.map((testCase) => JSON.stringify(testCase)).join("\n")}\n`,
        );
        let errors;
        assert.doesNotThrow(() => {
            errors = validateDiagnosticsPilot(root);
        });
        for (const expected of [
            "Diagnostics metadata must be an object",
            "Diagnostics routes must be an object",
            "Diagnostics result contract must be an object",
            "Diagnostics assertions must be an object",
            "Diagnostics case must be an object",
        ])
            assert(errors.includes(expected), expected);
    });
});

test("diagnostics pilot closes metadata and coordinated execution schemas", () => {
    withFixture((root) => {
        const metadataPath = join(
            root,
            "pilots/application-slice-diagnostics/metadata.draft.json",
        );
        const contractPath = join(
            root,
            "pilots/application-slice-diagnostics/result-contract.json",
        );
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        metadata.effects = {};
        metadata.runtimeApproved = null;
        metadata.sourceScope = "public";
        metadata.enabledEvaluationCaseIds = null;
        metadata.publicationAllowed = false;
        writeFileSync(metadataPath, JSON.stringify(metadata));
        const contract = JSON.parse(readFileSync(contractPath, "utf8"));
        contract.executionConstants.repositoryMutation = true;
        contract.objectFields.execution.push("repositoryMutation");
        contract.outputFields.push("publicationAllowed");
        contract.instrumentationApplyAllowed = null;
        contract.maximumHypotheses = null;
        contract.maximumInstrumentationRequests = 999;
        contract.resultSchemaVersion = "unapproved-v2";
        contract.dispositions.push("APPROVED");
        contract.approvalAllowed = false;
        contract.reasonBindings["The pilot executed a replay."] = {
            lane: "unresolved",
            disposition: "BLOCKED",
        };
        writeFileSync(contractPath, JSON.stringify(contract));
        const errors = validateDiagnosticsPilot(root);
        assert(errors.some((error) => error.includes("metadata fields changed")));
        assert(errors.some((error) => error.includes("metadata constants changed")));
        assert(errors.some((error) => error.includes("metadata collections changed")));
        assert(errors.some((error) => error.includes("enabled-case contract changed")));
        assert(errors.some((error) => error.includes("absent from runtime")));
        assert(errors.some((error) => error.includes("permits execution")));
        assert(errors.some((error) => error.includes("result contract fields changed")));
        assert(errors.some((error) => error.includes("output schema changed")));
        assert(errors.some((error) => error.includes("reason bindings changed")));
    });
});

test("diagnostics output denies unavailable fixtures and disabled cases", () => {
    const contract = JSON.parse(
        readFileSync(
            join(repositoryRoot, "pilots/application-slice-diagnostics/result-contract.json"),
            "utf8",
        ),
    );
    const metadata = JSON.parse(
        readFileSync(
            join(repositoryRoot, "pilots/application-slice-diagnostics/metadata.draft.json"),
            "utf8",
        ),
    );
    const sourceErrors = validateDiagnosticsResult(
        validFixedResult(),
        contract,
        metadata,
    );
    assert(sourceErrors.some((error) => error.includes("case identifier is not enabled")));
    assert(sourceErrors.some((error) => error.includes("verified profiles are disabled")));
    assert(sourceErrors.some((error) => error.includes("source diagnosis is disabled")));
    const instrumentationErrors = validateDiagnosticsResult(
        validInstrumentationResult(),
        contract,
        metadata,
    );
    assert(instrumentationErrors.some((error) => error.includes("case identifier is not enabled")));
    assert(instrumentationErrors.some((error) => error.includes("instrumentation is disabled")));
    const disabledProfileCase = validHandoffResult();
    disabledProfileCase.caseId = "N03";
    disabledProfileCase.lane = "non-cratis";
    disabledProfileCase.disposition = "SKIPPED";
    disabledProfileCase.reasonCode = "PROFILE_NON_CRATIS";
    disabledProfileCase.conclusion =
        "The request is outside the Cratis repository profile.";
    disabledProfileCase.handoffs = [];
    disabledProfileCase.skipped = ["PROFILE_NON_CRATIS"];
    const broadenedMetadata = structuredClone(metadata);
    broadenedMetadata.enabledEvaluationCaseIds.push("N03");
    assert(
        validateDiagnosticsResult(
            disabledProfileCase,
            contract,
            broadenedMetadata,
        ).some((error) => error.includes("case identifier is not enabled")),
    );
});

test("diagnostics execution constants are property-order independent", () => {
    const contract = JSON.parse(
        readFileSync(
            join(repositoryRoot, "pilots/application-slice-diagnostics/result-contract.json"),
            "utf8",
        ),
    );
    const metadata = JSON.parse(
        readFileSync(
            join(repositoryRoot, "pilots/application-slice-diagnostics/metadata.draft.json"),
            "utf8",
        ),
    );
    const result = validHandoffResult();
    result.execution = Object.fromEntries(Object.entries(result.execution).reverse());
    assert.deepEqual(validateDiagnosticsResult(result, contract, metadata), []);
});

test("diagnostics result contract rejects execution, invalid lanes, and unsafe instrumentation", () => {
    const contract = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/result-contract.json",
            ),
            "utf8",
        ),
    );
    const metadata = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/metadata.draft.json",
            ),
            "utf8",
        ),
    );
    const valid = validHandoffResult();
    assert.deepEqual(validateDiagnosticsResult(valid, contract, metadata), []);

    const unsafe = structuredClone(valid);
    unsafe.runtimeApproved = true;
    unsafe.publicationAllowed = true;
    unsafe.disposition = "SOURCE_DIAGNOSIS";
    unsafe.execution.performed = true;
    unsafe.execution.commands = ["replay"];
    unsafe.instrumentationRequests = [
        {
            id: "I1",
            hypothesisId: "H1",
            relativePath: "../secret",
            symbol: "Run",
            signal: "payload",
            allowedFields: ["payload"],
            forbiddenFields: [],
            maximumRecords: 0,
            redactionRule: "none",
            removalTrigger: "never",
            cleanupSteps: [],
            cleanupVerification: "",
            applyAllowed: true,
            status: "APPLIED",
        },
    ];
    const errors = validateDiagnosticsResult(unsafe, contract, metadata);
    assert(
        errors.some((error) =>
            error.includes("unknown property publicationAllowed"),
        ),
    );
    assert(errors.some((error) => error.includes("constants changed")));
    assert(errors.some((error) => error.includes("does not allow")));
    assert(errors.some((error) => error.includes("execution constants changed")));
    assert(errors.some((error) => error.includes("unsafe or incomplete")));
});

test("diagnostics pilot rejects ninth lanes and coordinated handoff drift", () => {
    withFixture((root) => {
        const contractPath = join(
            root,
            "pilots/application-slice-diagnostics/result-contract.json",
        );
        const routesPath = join(
            root,
            "pilots/application-slice-diagnostics/symptom-routes.json",
        );
        const contract = JSON.parse(readFileSync(contractPath, "utf8"));
        const routes = JSON.parse(readFileSync(routesPath, "utf8"));
        contract.lanes.push("none");
        contract.laneDispositions.none = ["BLOCKED"];
        routes.routes[0].lane = { toString: null, valueOf: null };
        routes.routes[1].allowedDispositions = [
            { toString: null, valueOf: null },
        ];
        routes.routes.push({
            lane: "none",
            symptoms: ["unknown"],
            requiredEvidence: [],
            allowedDispositions: ["BLOCKED"],
            handoff: null,
        });
        contract.laneDispositions["chronicle-live-state"].push("INCONCLUSIVE");
        routes.routes
            .find((route) => route.lane === "observable-query-http")
            .allowedDispositions.push("INCONCLUSIVE");
        routes.routes.find(
            (route) => route.lane === "framework-source",
        ).allowedDispositions = null;
        writeFileSync(contractPath, JSON.stringify(contract));
        writeFileSync(routesPath, JSON.stringify(routes));
        const errors = validateDiagnosticsPilot(root);
        assert(
            errors.some((error) =>
                error.includes("canonical eight-lane set"),
            ),
        );
        assert(
            errors.some((error) =>
                error.includes("canonical disposition contract changed"),
            ),
        );
        assert(
            errors.some((error) => error.includes("dispositions must be an array")),
        );
    });
});

test("diagnostics instrumentation rejects protected paths and sensitive signals", () => {
    const contract = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/result-contract.json",
            ),
            "utf8",
        ),
    );
    const metadata = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/metadata.draft.json",
            ),
            "utf8",
        ),
    );
    const fixtureMetadata = enableFutureFixtures(metadata, "P08");
    const structurallyValidInstrumentationErrors = validateDiagnosticsResult(
        validInstrumentationResult(),
        contract,
        fixtureMetadata,
    );
    assert(
        structurallyValidInstrumentationErrors.some((error) =>
            error.includes("instrumentation is disabled"),
        ),
    );
    assert(
        !structurallyValidInstrumentationErrors.some((error) =>
            error.includes("unsafe or incomplete"),
        ),
    );
    for (const protectedPath of [
        ".agents/PROJECT.md",
        ".ai/hooks/agent-stop.md",
        ".git/config",
        ".github/workflows/verify.yml",
        ".pi/tasks/output.json",
        "AGENTS.md",
        "C:/Source/Projection.cs",
        "Directory.Packages.props",
        "Project.csproj",
        "build/diagnostics.js",
        "dependencies/diagnostics.js",
        "dependency/diagnostics.js",
        "dist/diagnostics.js",
        "distribution/diagnostics.js",
        "node_modules/pkg/index.js",
        "obj/Debug/net8.0/App.AssemblyInfo.cs",
        "npm-shrinkwrap.json",
        "package-lock.json",
        "package.json",
        "plugins/diagnostics.js",
        "pnpm-lock.yaml",
        "runtime/diagnostics.js",
        "Source/AssemblyInfo.cs",
        "Source/AssemblyAttributes.cs",
        "Source/Bad\nName.cs",
        "Source/Bad\tName.cs",
        "Source/Bad\u0085Name.cs",
        "Source/Generated/Projection.cs",
        "Source/GeneratedCode/Projection.cs",
        "Source/Generated.g.cs",
        "Source/Proxy.generated.ts",
        "Source/View.g.i.cs",
        "Source/View.generated.d.ts",
        "yarn.lock",
    ]) {
        const result = validInstrumentationResult();
        result.instrumentationRequests[0].relativePath = protectedPath;
        assert(
            validateDiagnosticsResult(result, contract, metadata).some((error) =>
                error.includes("unsafe or incomplete"),
            ),
            protectedPath,
        );
    }
    const unsafeMutations = [
        ["applied status", (request) => (request.status = "APPLIED")],
        ["payload signal", (request) => (request.signal = "payload")],
        ["payload field", (request) => (request.allowedFields = ["payload"])],
        ["missing forbidden fields", (request) => (request.forbiddenFields = [])],
        ["missing redaction", (request) => (request.redactionRule = "none")],
        ["zero records", (request) => (request.maximumRecords = 0)],
        ["unbounded records", (request) => (request.maximumRecords = Number.MAX_SAFE_INTEGER)],
        ["null id", (request) => (request.id = null)],
        ["overlength id", (request) => (request.id = "i".repeat(65))],
        ["invalid hypothesis binding", (request) => (request.hypothesisId = "missing")],
        ["empty symbol", (request) => (request.symbol = "")],
        ["overlength symbol", (request) => (request.symbol = "s".repeat(257))],
        ["duplicate field", (request) => (request.allowedFields = ["eventType", "eventType"])],
        ["missing cleanup", (request) => (request.cleanupSteps = [])],
        ["invalid cleanup type", (request) => (request.cleanupSteps = [null])],
        ["overlength cleanup", (request) => (request.cleanupSteps = ["x".repeat(513)])],
        ["duplicate cleanup", (request) => (request.cleanupSteps = ["remove", "remove"])],
        ["invalid cleanup verification", (request) => (request.cleanupVerification = null)],
        ["overlength cleanup verification", (request) => (request.cleanupVerification = "x".repeat(513))],
        ["invalid removal trigger", (request) => (request.removalTrigger = null)],
        ["overlength removal trigger", (request) => (request.removalTrigger = "x".repeat(513))],
    ];
    for (const [label, mutate] of unsafeMutations) {
        const result = validInstrumentationResult();
        mutate(result.instrumentationRequests[0]);
        assert(
            validateDiagnosticsResult(result, contract, metadata).some((error) =>
                error.includes("unsafe or incomplete"),
            ),
            label,
        );
    }
    for (const [label, mutate] of [
        [
            "evidence-free hypothesis",
            (result) => (result.hypotheses[0].evidenceRefs = []),
        ],
        [
            "claim-free hypothesis",
            (result) => (result.hypotheses[0].productClaimRefs = []),
        ],
        [
            "evidence-free verified profile",
            (result) => (result.profile.evidenceRefs = []),
        ],
    ]) {
        const result = validInstrumentationResult();
        mutate(result);
        assert.notDeepEqual(
            validateDiagnosticsResult(result, contract, fixtureMetadata),
            [],
            label,
        );
    }
    const duplicateIds = validInstrumentationResult();
    duplicateIds.instrumentationRequests.push(
        structuredClone(duplicateIds.instrumentationRequests[0]),
    );
    assert(
        validateDiagnosticsResult(duplicateIds, contract, metadata).some((error) =>
            error.includes("identifiers are duplicated"),
        ),
    );
});

test("diagnostics output rejects untyped collections and escaped operation claims", () => {
    const contract = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/result-contract.json",
            ),
            "utf8",
        ),
    );
    const metadata = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/metadata.draft.json",
            ),
            "utf8",
        ),
    );
    contract.reasonBindings["The pilot executed a replay."] = {
        lane: "unresolved",
        disposition: "BLOCKED",
    };
    const result = validHandoffResult();
    result.blocked = ["The pilot executed a replay."];
    result.handoffs = [{ lane: "chronicle-live-state", execute: true }];
    result.limitations = ["Executed a replay outside the execution object."];
    result.redactions = Array.from({ length: 33 }, () => "redacted");
    const errors = validateDiagnosticsResult(result, contract, metadata);
    assert(errors.some((error) => error.includes("handoffs item is invalid")));
    assert(errors.some((error) => error.includes("blocked reason is unknown")));
    assert(errors.some((error) => error.includes("operation claim")));
    assert(errors.some((error) => error.includes("redactions collection is invalid")));
    const effectCode = validHandoffResult();
    effectCode.limitations = ["EXECUTED_REPLAY"];
    assert(
        validateDiagnosticsResult(effectCode, contract, metadata).some((error) =>
            error.includes("limitations must use canonical codes"),
        ),
    );
    const incompatibleCanonicalReason = validHandoffResult();
    incompatibleCanonicalReason.blocked = ["PROFILE_NON_CRATIS"];
    assert(
        validateDiagnosticsResult(
            incompatibleCanonicalReason,
            contract,
            metadata,
        ).some((error) => error.includes("disposition collections changed")),
    );
});

test("diagnostics output rejects malformed nested collections without throwing", () => {
    const contract = JSON.parse(
        readFileSync(
            join(repositoryRoot, "pilots/application-slice-diagnostics/result-contract.json"),
            "utf8",
        ),
    );
    const metadata = JSON.parse(
        readFileSync(
            join(repositoryRoot, "pilots/application-slice-diagnostics/metadata.draft.json"),
            "utf8",
        ),
    );
    assert(
        validateDiagnosticsResult(
            validHandoffResult(),
            contract,
            null,
        ).some((error) => error.includes("validation metadata must be an object")),
    );
    const getterOutput = validHandoffResult();
    Object.defineProperty(getterOutput, "lane", {
        enumerable: true,
        get() {
            throw new Error("getter should not run");
        },
    });
    const inheritedToJson = Object.assign(
        Object.create({ toJSON: () => null }),
        validHandoffResult(),
    );
    const ownToJson = validHandoffResult();
    ownToJson.toJSON = () => {
        throw null;
    };
    const trappedProxy = new Proxy(validHandoffResult(), {
        ownKeys() {
            throw new Error("proxy trap");
        },
    });
    const forwardingProxy = new Proxy(validHandoffResult(), {
        get(target, property, receiver) {
            if (property === "lane") throw new Error("get trap");
            return Reflect.get(target, property, receiver);
        },
    });
    const sparseArrayOutput = validHandoffResult();
    sparseArrayOutput.blocked = new Array(1);
    const outOfRangeIndexOutput = validHandoffResult();
    outOfRangeIndexOutput.blocked = [];
    Object.defineProperty(outOfRangeIndexOutput.blocked, "4294967295", {
        value: "AUTHORITY_UNVERIFIED",
        enumerable: true,
    });
    const hugeSparseOutput = validHandoffResult();
    hugeSparseOutput.blocked = new Array(100000000);
    const hugeDenseOutput = validHandoffResult();
    hugeDenseOutput.blocked = new Array(10001).fill("AUTHORITY_UNVERIFIED");
    const hugeKeyOutput = validHandoffResult();
    Object.defineProperty(hugeKeyOutput, "x".repeat(1000000), {
        value: true,
        enumerable: true,
    });
    for (const adversarial of [
        getterOutput,
        inheritedToJson,
        ownToJson,
        trappedProxy,
        forwardingProxy,
        sparseArrayOutput,
        outOfRangeIndexOutput,
        hugeSparseOutput,
        hugeDenseOutput,
        hugeKeyOutput,
    ]) {
        let adversarialErrors;
        assert.doesNotThrow(() => {
            adversarialErrors = validateDiagnosticsResult(
                adversarial,
                contract,
                metadata,
            );
        });
        assert(
            adversarialErrors.some((error) => error.includes("unsafe content")),
        );
    }
    const originalByteLength = Buffer.byteLength;
    let oversizedKeyScanned = false;
    Buffer.byteLength = (value, ...arguments_) => {
        if (typeof value === "string" && value.length > 65536)
            oversizedKeyScanned = true;
        return originalByteLength(value, ...arguments_);
    };
    try {
        validateDiagnosticsResult(hugeKeyOutput, contract, metadata);
    } finally {
        Buffer.byteLength = originalByteLength;
    }
    assert.equal(oversizedKeyScanned, false);
    Object.defineProperty(Array.prototype, "toJSON", {
        value: () => null,
        configurable: true,
    });
    try {
        const nullPrototypeOutput = Object.assign(
            Object.create(null),
            validHandoffResult(),
        );
        assert(
            validateDiagnosticsResult(
                nullPrototypeOutput,
                contract,
                metadata,
            ).some((error) => error.includes("unsafe content")),
        );
    } finally {
        delete Array.prototype.toJSON;
    }
    const originalArrayPrototypeParent = Object.getPrototypeOf(Array.prototype);
    Object.setPrototypeOf(Array.prototype, { toJSON: () => null });
    let inheritedHookErrors;
    try {
        inheritedHookErrors = validateDiagnosticsResult(
            validHandoffResult(),
            contract,
            metadata,
        );
    } finally {
        Object.setPrototypeOf(Array.prototype, originalArrayPrototypeParent);
    }
    assert(
        inheritedHookErrors.some((error) => error.includes("unsafe content")),
    );
    Object.defineProperty(Object.prototype, "publicationAllowed", {
        get() {
            throw new Error("inherited getter should never run");
        },
        configurable: true,
    });
    Object.defineProperty(Object.prototype, "error", {
        get() {
            throw new Error("wrapper error getter should never run");
        },
        configurable: true,
    });
    Object.defineProperty(Object.prototype, "get", {
        get() {
            throw new Error("descriptor get getter should never run");
        },
        configurable: true,
    });
    Object.defineProperty(Object.prototype, "set", {
        get() {
            throw new Error("descriptor set getter should never run");
        },
        configurable: true,
    });
    let prototypeSafeErrors;
    let getterRejectionErrors;
    try {
        assert.doesNotThrow(() => {
            prototypeSafeErrors = validateDiagnosticsResult(
                validHandoffResult(),
                contract,
                metadata,
            );
        });
        assert.doesNotThrow(() => {
            getterRejectionErrors = validateDiagnosticsResult(
                getterOutput,
                contract,
                metadata,
            );
        });
    } finally {
        delete Object.prototype.publicationAllowed;
        delete Object.prototype.error;
        delete Object.prototype.get;
        delete Object.prototype.set;
    }
    assert.deepEqual(prototypeSafeErrors, []);
    assert(
        getterRejectionErrors.some((error) => error.includes("unsafe content")),
    );
    const sharedReferences = validHandoffResult();
    const sharedReferenceArray = [];
    sharedReferences.profile.evidenceRefs = sharedReferenceArray;
    sharedReferences.symptom.evidenceRefs = sharedReferenceArray;
    assert.deepEqual(
        validateDiagnosticsResult(sharedReferences, contract, metadata),
        [],
    );
    const proxiedContract = new Proxy(contract, {
        get() {
            throw new Error("contract get trap");
        },
    });
    assert.doesNotThrow(() =>
        validateDiagnosticsResult(
            validHandoffResult(),
            proxiedContract,
            metadata,
        ),
    );
    assert(
        validateDiagnosticsResult(
            validHandoffResult(),
            proxiedContract,
            metadata,
        ).some((error) => error.includes("result contract must be an object")),
    );
    const mutations = [
        ["prototype lane", (result) => (result.lane = "__proto__")],
        ["prototype reason", (result) => (result.reasonCode = "__proto__")],
        [
            "uncoercible lane",
            (result) => (result.lane = { toString: null, valueOf: null }),
        ],
        [
            "uncoercible reason",
            (result) =>
                (result.reasonCode = { toString: null, valueOf: null }),
        ],
        [
            "source binding path",
            (result) =>
                (result.sourceBinding.repositoryRevision = "../../private-key"),
        ],
        [
            "source binding drive",
            (result) =>
                (result.sourceBinding.evidenceBundleDigest = "C:private-key"),
        ],
        ["profile null", (result) => (result.profile.evidenceRefs = [null])],
        ["profile duplicate", (result) => (result.profile.evidenceRefs = ["e", "e"])],
        ["profile path", (result) => (result.profile.evidenceRefs = ["../../private-key"])],
        ["symptom null", (result) => (result.symptom.reproductionSteps = [null])],
        ["symptom evidence path", (result) => (result.symptom.evidenceRefs = ["/etc/passwd"])],
        [
            "symptom bound",
            (result) =>
                (result.symptom.reproductionSteps = Array.from(
                    { length: 13 },
                    (_, index) => `step-${index}`,
                )),
        ],
        ["hypothesis null", (result) => (result.hypotheses = [null])],
        ["instrumentation null", (result) => (result.instrumentationRequests = [null])],
        ["instrumentation scalar", (result) => (result.instrumentationRequests = "x")],
        ["proof null", (result) => (result.proof.failingArtifactRefs = [null])],
        ["proof duplicate", (result) => (result.proof.failingArtifactRefs = ["f", "f"])],
        ["proof path", (result) => (result.proof.failingArtifactRefs = ["../../private-key"])],
        ["cleanup null", (result) => (result.cleanup.instrumentationIds = [null])],
        ["cleanup duplicate", (result) => (result.cleanup.removalProofRefs = ["p", "p"])],
        [
            "cleanup bound",
            (result) =>
                (result.cleanup.removalProofRefs = Array.from(
                    { length: 33 },
                    (_, index) => `proof-${index}`,
                )),
        ],
    ];
    for (const [label, mutate] of mutations) {
        const result = validHandoffResult();
        mutate(result);
        assert.doesNotThrow(() => validateDiagnosticsResult(result, contract, metadata));
        assert.notDeepEqual(
            validateDiagnosticsResult(result, contract, metadata),
            [],
            label,
        );
    }
    const deeplyNested = validHandoffResult();
    let nested = { value: "leaf" };
    for (let index = 0; index < 40; index++) nested = { nested };
    deeplyNested.facts = [
        { statement: nested, evidenceRefs: [], productClaimRefs: [] },
    ];
    assert.doesNotThrow(() =>
        validateDiagnosticsResult(deeplyNested, contract, metadata),
    );
    assert(
        validateDiagnosticsResult(deeplyNested, contract, metadata).some((error) =>
            error.includes("unsafe content"),
        ),
    );
    const cyclic = validHandoffResult();
    const cyclicFact = {};
    cyclicFact.self = cyclicFact;
    cyclic.facts = [cyclicFact];
    assert.doesNotThrow(() =>
        validateDiagnosticsResult(cyclic, contract, metadata),
    );
    assert(
        validateDiagnosticsResult(cyclic, contract, metadata).some((error) =>
            error.includes("unsafe content"),
        ),
    );
    const bigintValue = validHandoffResult();
    bigintValue.blocked = [1n];
    assert.doesNotThrow(() =>
        validateDiagnosticsResult(bigintValue, contract, metadata),
    );
    assert(
        validateDiagnosticsResult(bigintValue, contract, metadata).some((error) =>
            error.includes("unsafe content"),
        ),
    );
    const duplicateFactReference = validHandoffResult();
    duplicateFactReference.facts = [
        {
            statement: "A bounded source fact.",
            evidenceRefs: ["artifact", "artifact"],
            productClaimRefs: [],
        },
    ];
    assert(
        validateDiagnosticsResult(
            duplicateFactReference,
            contract,
            metadata,
        ).some((error) => error.includes("fact values are invalid")),
    );
    const duplicateFacts = validHandoffResult();
    const fact = {
        statement: "A bounded source fact.",
        evidenceRefs: ["artifact"],
        productClaimRefs: [],
    };
    duplicateFacts.facts = [fact, structuredClone(fact)];
    assert(
        validateDiagnosticsResult(duplicateFacts, contract, metadata).some(
            (error) => error.includes("facts are duplicated"),
        ),
    );
    for (const [label, evidenceRefs] of [
        ["hypothesis duplicate", ["e", "e"]],
        [
            "hypothesis bound",
            Array.from({ length: 33 }, (_, index) => `evidence-${index}`),
        ],
    ]) {
        const result = validInstrumentationResult();
        result.hypotheses[0].evidenceRefs = evidenceRefs;
        assert(
            validateDiagnosticsResult(result, contract, metadata).some((error) =>
                error.includes("hypothesis values are invalid"),
            ),
            label,
        );
    }
});

test("diagnostics operation claims cannot escape through narrative fields", () => {
    const contract = JSON.parse(
        readFileSync(
            join(repositoryRoot, "pilots/application-slice-diagnostics/result-contract.json"),
            "utf8",
        ),
    );
    const metadata = JSON.parse(
        readFileSync(
            join(repositoryRoot, "pilots/application-slice-diagnostics/metadata.draft.json"),
            "utf8",
        ),
    );
    const mutations = [
        (result) => (result.conclusion = "I executed a replay."),
        (result) => (result.conclusion = "I did execute a replay."),
        (result) => (result.conclusion = "The agent successfully executed a replay."),
        (result) => (result.conclusion = "The system has executed a replay."),
        (result) => (result.conclusion = "The tool had already executed a replay."),
        (result) =>
            (result.facts = [
                {
                    statement: "Executed a replay.",
                    evidenceRefs: ["artifact"],
                    productClaimRefs: [],
                },
            ]),
        (result) => (result.limitations = ["We invoked the live system."]),
        (result) => {
            const instrumented = validInstrumentationResult();
            Object.assign(result, instrumented);
            result.instrumentationRequests[0].cleanupVerification =
                "The pilot applied the instrumentation.";
        },
    ];
    for (const mutate of mutations) {
        const result = validHandoffResult();
        mutate(result);
        assert(
            validateDiagnosticsResult(result, contract, metadata).some((error) =>
                error.includes("operation claim"),
            ),
        );
    }
    const synonymousClaim = validHandoffResult();
    synonymousClaim.conclusion =
        "The command completed successfully and the event was appended.";
    assert(
        validateDiagnosticsResult(synonymousClaim, contract, metadata).some(
            (error) => error.includes("conclusion is not canonical"),
        ),
    );
    const quotedSymptom = validHandoffResult();
    quotedSymptom.symptom.observed =
        "The user reported that a command completed and an event was appended.";
    assert(
        !validateDiagnosticsResult(quotedSymptom, contract, metadata).some(
            (error) => error.includes("operation claim"),
        ),
    );
});

test("diagnostics proof and cleanup claims remain disabled before fixtures", () => {
    const contract = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/result-contract.json",
            ),
            "utf8",
        ),
    );
    const metadata = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/metadata.draft.json",
            ),
            "utf8",
        ),
    );
    const claimedFix = validateDiagnosticsResult(
        validFixedResult(),
        contract,
        enableFutureFixtures(metadata, "P01"),
    );
    for (const denial of [
        "verified profiles are disabled",
        "source diagnosis is disabled",
        "source claims are disabled",
        "proof claims are disabled",
        "cleanup claims are disabled",
    ])
        assert(claimedFix.some((error) => error.includes(denial)), denial);

    const pendingInstrumentation = validateDiagnosticsResult(
        validInstrumentationResult(),
        contract,
        enableFutureFixtures(metadata, "P08"),
    );
    assert(
        pendingInstrumentation.some((error) =>
            error.includes("instrumentation is disabled"),
        ),
    );
    assert(
        pendingInstrumentation.some((error) =>
            error.includes("source claims are disabled"),
        ),
    );

    const malformed = validFixedResult();
    malformed.proof.userVisibleRegressionProven = "false";
    malformed.proof.failingArtifactRefs = [null];
    assert(
        validateDiagnosticsResult(malformed, contract, metadata).some((error) =>
            error.includes("proof values are invalid"),
        ),
    );
});

test("diagnostics output rejects unsafe content and oversized results", () => {
    const contract = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/result-contract.json",
            ),
            "utf8",
        ),
    );
    const metadata = JSON.parse(
        readFileSync(
            join(
                repositoryRoot,
                "pilots/application-slice-diagnostics/metadata.draft.json",
            ),
            "utf8",
        ),
    );
    const result = validHandoffResult();
    result.conclusion = `github_pat_${"a".repeat(24)}${"x".repeat(70000)}`;
    const errors = validateDiagnosticsResult(result, contract, metadata);
    assert(errors.some((error) => error.includes("unsafe content")));
    assert(errors.some((error) => error.includes("exceeds byte limit")));
});

test("diagnostics pilot rejects lane and reason relationship drift", () => {
    withFixture((root) => {
        const path = join(
            root,
            "evals/application-slice-diagnostics/cases.jsonl",
        );
        const cases = readDiagnosticsCases(root);
        const liveCase = cases.find((testCase) => testCase.id === "P09");
        liveCase.expected.disposition = "SOURCE_DIAGNOSIS";
        liveCase.expected.reasonCode = "SOURCE_CAUSE_SUPPORTED";
        const lexicalCase = cases.find((testCase) => testCase.id === "N04");
        lexicalCase.expected = {
            disposition: "BLOCKED",
            lane: "unresolved",
            reasonCode: "AUTHORITY_UNVERIFIED",
        };
        writeFileSync(
            path,
            `${cases.map((testCase) => JSON.stringify(testCase)).join("\n")}\n`,
        );
        const errors = validateDiagnosticsPilot(root);
        assert(
            errors.some((error) =>
                error.includes("disposition is invalid for its lane"),
            ),
        );
        assert(errors.some((error) => error.includes("reason binding changed")));
        assert(
            errors.some((error) =>
                error.includes("N04: diagnostics expected binding changed"),
            ),
        );
    });
});

test("diagnostics pilot cannot swap fixture-dependent case enablement", () => {
    withFixture((root) => {
        const path = join(
            root,
            "evals/application-slice-diagnostics/cases.jsonl",
        );
        const cases = readDiagnosticsCases(root);
        const sourceCase = cases.find((testCase) => testCase.id === "P01");
        const lexicalCase = cases.find((testCase) => testCase.id === "N04");
        sourceCase.enabled = true;
        sourceCase.fixtureStatus = "not-required";
        lexicalCase.enabled = false;
        lexicalCase.fixtureStatus = "missing-authority-bundle";
        writeFileSync(
            path,
            `${cases.map((testCase) => JSON.stringify(testCase)).join("\n")}\n`,
        );
        const errors = validateDiagnosticsPilot(root);
        assert(
            errors.some((error) =>
                error.includes("fixture-dependent case set changed"),
            ),
        );
    });
});

test("diagnostics pilot pins each disabled fixture class", () => {
    withFixture((root) => {
        const path = join(
            root,
            "evals/application-slice-diagnostics/cases.jsonl",
        );
        const cases = readDiagnosticsCases(root);
        const authorityCase = cases.find((testCase) => testCase.id === "P08");
        const profileCase = cases.find((testCase) => testCase.id === "N13");
        [authorityCase.fixtureStatus, profileCase.fixtureStatus] = [
            profileCase.fixtureStatus,
            authorityCase.fixtureStatus,
        ];
        writeFileSync(
            path,
            `${cases.map((testCase) => JSON.stringify(testCase)).join("\n")}\n`,
        );
        const errors = validateDiagnosticsPilot(root);
        assert(
            errors.filter((error) => error.includes("disabled case reason changed"))
                .length >= 2,
        );
    });
});

test("diagnostics pilot rejects null cases and non-boolean enablement", () => {
    withFixture((root) => {
        const path = join(
            root,
            "evals/application-slice-diagnostics/cases.jsonl",
        );
        const cases = readDiagnosticsCases(root);
        cases[0] = null;
        cases[1].enabled = 1;
        cases[2].prompt = null;
        cases[3].id = { toString: null, valueOf: null };
        writeFileSync(
            path,
            `${cases.map((testCase) => JSON.stringify(testCase)).join("\n")}\n`,
        );
        let errors;
        assert.doesNotThrow(() => {
            errors = validateDiagnosticsPilot(root);
        });
        assert(errors.includes("Diagnostics case must be an object"));
        assert(
            errors.some((error) =>
                error.includes("diagnostics enablement must be boolean"),
            ),
        );
        assert(
            errors.some((error) =>
                error.includes("diagnostics case values are invalid"),
            ),
        );
    });
});

test("diagnostics pilot rejects additive unknown case kinds", () => {
    withFixture((root) => {
        const casesPath = join(
            root,
            "evals/application-slice-diagnostics/cases.jsonl",
        );
        const assertionsPath = join(
            root,
            "evals/application-slice-diagnostics/assertions.json",
        );
        const metadataPath = join(
            root,
            "pilots/application-slice-diagnostics/metadata.draft.json",
        );
        const cases = readDiagnosticsCases(root);
        cases[0].executionAllowed = true;
        cases[0].expected.executionAllowed = true;
        cases.push({
            id: "X01",
            kind: "other",
            enabled: true,
            fixtureStatus: "not-required",
            prompt: "An unrecognized additive case.",
            expected: structuredClone(cases.find((item) => item.id === "N04").expected),
        });
        writeFileSync(
            casesPath,
            `${cases.map((testCase) => JSON.stringify(testCase)).join("\n")}\n`,
        );
        const assertions = JSON.parse(readFileSync(assertionsPath, "utf8"));
        assertions.enabledCases = 11;
        writeFileSync(assertionsPath, JSON.stringify(assertions));
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        metadata.enabledEvaluationCaseIds.push("X01");
        writeFileSync(metadataPath, JSON.stringify(metadata));
        const errors = validateDiagnosticsPilot(root);
        assert(errors.some((error) => error.includes("canonical case identifiers changed")));
        assert(errors.some((error) => error.includes("unknown property executionAllowed")));
        assert(errors.some((error) => error.includes("case kind changed")));
        assert(errors.some((error) => error.includes("enabled-case contract changed")));
    });
});

test("diagnostics routing keeps source, live, HTTP, and repository profiles distinct", () => {
    const cases = new Map(
        readDiagnosticsCases().map((testCase) => [testCase.id, testCase]),
    );
    assert.deepEqual(cases.get("P09").expected, {
        disposition: "HANDOFF",
        lane: "chronicle-live-state",
        reasonCode: "LIVE_STATE_REQUIRED",
    });
    assert.deepEqual(cases.get("P10").expected, {
        disposition: "HANDOFF",
        lane: "observable-query-http",
        reasonCode: "OBSERVABLE_HTTP_EVIDENCE_REQUIRED",
    });
    assert.equal(cases.get("N01").expected.reasonCode, "PROFILE_FRAMEWORK");
    assert.equal(cases.get("N02").expected.reasonCode, "PROFILE_CLIENT");
    assert.equal(cases.get("N03").expected.reasonCode, "PROFILE_NON_CRATIS");
    assert.equal(cases.get("N07").expected.disposition, "REFUSED");
    assert.equal(cases.get("N08").expected.disposition, "REFUSED");
});
