// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.ObjectModel;
using Cratis.Factory.Hashing;

namespace Cratis.Factory.Definitions;

/// <summary>
/// Identifies the overall bounded definition compilation outcome.
/// </summary>
public enum DefinitionCompilationStatus
{
    /// <summary>The requested workflow compiled successfully.</summary>
    Compiled = 0,

    /// <summary>The input or workflow was rejected.</summary>
    Rejected = 1,

    /// <summary>More diagnostics existed than the result may retain.</summary>
    DiagnosticLimitExceeded = 2,

    /// <summary>Schema evaluation exceeded its bounded work limit.</summary>
    EvaluationLimitExceeded = 3
}

/// <summary>
/// Describes one admitted definition and its exact schema closure.
/// </summary>
/// <param name="LogicalId">The safe caller logical identifier.</param>
/// <param name="Kind">The exact caller-selected route.</param>
/// <param name="SchemaId">The exact admitted schema resource.</param>
/// <param name="SchemaClosureIdentity">The resolved closure identity.</param>
/// <param name="ContentHash">The canonical definition content hash.</param>
public sealed record DefinitionDescriptor(
    string LogicalId,
    DefinitionKind Kind,
    string SchemaId,
    Sha256Hash SchemaClosureIdentity,
    Sha256Hash ContentHash);

/// <summary>
/// Represents a total, immutable definition compilation result.
/// </summary>
public sealed class DefinitionCompilationResult
{
    internal DefinitionCompilationResult(
        DefinitionCompilationStatus status,
        string workflowId,
        Sha256Hash? schemaSetIdentity,
        Sha256Hash? definitionSetIdentity,
        IEnumerable<DefinitionDescriptor> definitions,
        CompiledWorkflow? workflow,
        IEnumerable<DefinitionDiagnostic> diagnostics)
    {
        Status = status;
        WorkflowId = workflowId;
        SchemaSetIdentity = schemaSetIdentity;
        DefinitionSetIdentity = definitionSetIdentity;
        Definitions = new ReadOnlyCollection<DefinitionDescriptor>([.. definitions]);
        Workflow = workflow;
        Diagnostics = new ReadOnlyCollection<DefinitionDiagnostic>([.. diagnostics]);
    }

    /// <summary>Gets the overall compilation outcome.</summary>
    public DefinitionCompilationStatus Status { get; }

    /// <summary>Gets the safe requested workflow identifier, or an empty value when it was invalid.</summary>
    public string WorkflowId { get; }

    /// <summary>Gets the supplied schema-set identity when a set was supplied.</summary>
    public Sha256Hash? SchemaSetIdentity { get; }

    /// <summary>Gets the admitted definition-set identity.</summary>
    public Sha256Hash? DefinitionSetIdentity { get; }

    /// <summary>Gets the immutable ordered admitted definition descriptors.</summary>
    public IReadOnlyList<DefinitionDescriptor> Definitions { get; }

    /// <summary>Gets the compiled workflow when compilation succeeds.</summary>
    public CompiledWorkflow? Workflow { get; }

    /// <summary>Gets the immutable globally ordered diagnostics.</summary>
    public IReadOnlyList<DefinitionDiagnostic> Diagnostics { get; }
}
