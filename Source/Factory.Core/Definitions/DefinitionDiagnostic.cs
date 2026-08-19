// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Canonicalization;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.Definitions;

/// <summary>
/// Identifies the severity of a definition compilation diagnostic.
/// </summary>
public enum DefinitionDiagnosticSeverity
{
    /// <summary>An error that prevents compilation.</summary>
    Error = 0
}

/// <summary>
/// Identifies the stable classification of a definition compilation diagnostic.
/// </summary>
public enum DefinitionDiagnosticStatus
{
    /// <summary>A schema violation.</summary>
    Violation = 0,

    /// <summary>A rejected input or semantic condition.</summary>
    Rejected = 1,

    /// <summary>A bounded resource limit was exceeded.</summary>
    LimitExceeded = 2
}

/// <summary>
/// Identifies every stable definition and workflow compilation diagnostic.
/// </summary>
public enum DefinitionDiagnosticCode
{
    SchemaSetRequired = 0,
    SchemaSetNotAccepted = 1,
    NoDefinitions = 2,
    DefinitionLimitExceeded = 3,
    AggregateDefinitionBytesLimitExceeded = 4,
    DefinitionEnumerationFailed = 5,
    InvalidDefinitionLogicalId = 6,
    DuplicateDefinitionLogicalId = 7,
    UnsupportedDefinitionKind = 8,
    CanonicalDefinitionRejected = 9,
    DefinitionSchemaRejected = 10,
    DefinitionSchemaViolation = 11,
    DefinitionEvaluationLimitExceeded = 12,
    InvalidWorkflowId = 13,
    WorkflowNotFound = 14,
    DuplicateWorkflowId = 15,
    DuplicateWorkflowInputId = 16,
    DuplicatePhaseId = 17,
    DuplicatePhaseInputName = 18,
    DuplicateGateId = 19,
    DuplicateCapabilityId = 20,
    WorkflowInputLimitExceeded = 21,
    CapabilityLimitExceeded = 22,
    PhaseLimitExceeded = 23,
    PhaseInputLimitExceeded = 24,
    GateLimitExceeded = 25,
    DependencyEdgeLimitExceeded = 26,
    SemanticWorkLimitExceeded = 27,
    UnknownDependency = 28,
    DependencyCycle = 29,
    UnknownWorkflowInput = 30,
    UnknownProducerPhase = 31,
    ProducerNotAncestor = 32,
    UnknownCapability = 33,
    UnsupportedCapabilityUsage = 34,
    UnsupportedCapabilityGateKind = 35,
    UnknownSchemaReference = 36,
    UnknownCorrectionTarget = 37,
    CorrectionTargetNotAncestor = 38,
    AcceptanceUnknownGate = 39,
    AcceptanceMissingRequiredGate = 40,
    AcceptanceIncludesNonRequiredGate = 41,
    UnknownSuccessPhase = 42,
    SuccessPhaseHasDependents = 43,
    PhaseDoesNotLeadToSuccess = 44,
    UnsupportedPhaseScope = 45,
    NormalizedOutputLimitExceeded = 46,
    DiagnosticLimitExceeded = 47
}

/// <summary>
/// Describes one stable, bounded compiler diagnostic without caller prose or values.
/// </summary>
/// <param name="Code">The stable diagnostic code.</param>
/// <param name="Severity">The diagnostic severity.</param>
/// <param name="Status">The diagnostic classification.</param>
/// <param name="LogicalId">The admitted logical definition identifier, when safe.</param>
/// <param name="Location">The stable compiler-owned location.</param>
/// <param name="RelatedId">A related admitted identifier, when applicable.</param>
/// <param name="CanonicalCode">The underlying canonical JSON code, when applicable.</param>
/// <param name="SchemaCode">The underlying schema-validation code, when applicable.</param>
public sealed record DefinitionDiagnostic(
    DefinitionDiagnosticCode Code,
    DefinitionDiagnosticSeverity Severity,
    DefinitionDiagnosticStatus Status,
    string LogicalId,
    string Location,
    string RelatedId,
    CanonicalJsonFailureCode? CanonicalCode,
    SchemaDiagnosticCode? SchemaCode);
