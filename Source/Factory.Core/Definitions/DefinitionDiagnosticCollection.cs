// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Canonicalization;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.Definitions;

sealed class DefinitionDiagnosticCollection
{
    const int MaximumDiagnostics = 256;
    readonly List<DefinitionDiagnostic> _diagnostics = [];

    public bool Overflowed { get; private set; }
    public bool EvaluationLimitExceeded { get; private set; }
    public bool HasDiagnostics => _diagnostics.Count > 0;

    public void MarkOverflow() => Overflowed = true;

    public void Add(
        DefinitionDiagnosticCode code,
        string logicalId = "",
        string location = "",
        string relatedId = "",
        CanonicalJsonFailureCode? canonicalCode = null,
        SchemaDiagnosticCode? schemaCode = null)
    {
        if (code is DefinitionDiagnosticCode.DefinitionEvaluationLimitExceeded)
        {
            EvaluationLimitExceeded = true;
        }

        var candidate = new DefinitionDiagnostic(
            code,
            DefinitionDiagnosticSeverity.Error,
            GetStatus(code),
            logicalId,
            location,
            relatedId,
            canonicalCode,
            schemaCode);
        if (_diagnostics.Count < MaximumDiagnostics)
        {
            _diagnostics.Add(candidate);
            return;
        }

        Overflowed = true;
        var greatestIndex = 0;
        for (var index = 1; index < _diagnostics.Count; index++)
        {
            if (Compare(_diagnostics[index], _diagnostics[greatestIndex]) > 0)
            {
                greatestIndex = index;
            }
        }

        if (Compare(candidate, _diagnostics[greatestIndex]) < 0)
        {
            _diagnostics[greatestIndex] = candidate;
        }
    }

    public IReadOnlyList<DefinitionDiagnostic> ToReadOnly()
    {
        if (Overflowed)
        {
            if (_diagnostics.Count == MaximumDiagnostics)
            {
                var greatestIndex = 0;
                for (var index = 1; index < _diagnostics.Count; index++)
                {
                    if (Compare(_diagnostics[index], _diagnostics[greatestIndex]) > 0)
                    {
                        greatestIndex = index;
                    }
                }
                _diagnostics.RemoveAt(greatestIndex);
            }
            _diagnostics.Add(new(
                DefinitionDiagnosticCode.DiagnosticLimitExceeded,
                DefinitionDiagnosticSeverity.Error,
                DefinitionDiagnosticStatus.LimitExceeded,
                string.Empty,
                "diagnostics",
                string.Empty,
                null,
                null));
        }

        _diagnostics.Sort(Compare);
        return [.. _diagnostics];
    }

    public DefinitionCompilationStatus GetStatus()
    {
        if (EvaluationLimitExceeded) return DefinitionCompilationStatus.EvaluationLimitExceeded;
        if (Overflowed) return DefinitionCompilationStatus.DiagnosticLimitExceeded;
        return HasDiagnostics ? DefinitionCompilationStatus.Rejected : DefinitionCompilationStatus.Compiled;
    }

    static DefinitionDiagnosticStatus GetStatus(DefinitionDiagnosticCode code) => code switch
    {
        DefinitionDiagnosticCode.DefinitionSchemaViolation => DefinitionDiagnosticStatus.Violation,
        DefinitionDiagnosticCode.DefinitionLimitExceeded or
        DefinitionDiagnosticCode.AggregateDefinitionBytesLimitExceeded or
        DefinitionDiagnosticCode.DefinitionEvaluationLimitExceeded or
        DefinitionDiagnosticCode.WorkflowInputLimitExceeded or
        DefinitionDiagnosticCode.CapabilityLimitExceeded or
        DefinitionDiagnosticCode.PhaseLimitExceeded or
        DefinitionDiagnosticCode.PhaseInputLimitExceeded or
        DefinitionDiagnosticCode.GateLimitExceeded or
        DefinitionDiagnosticCode.DependencyEdgeLimitExceeded or
        DefinitionDiagnosticCode.SemanticWorkLimitExceeded or
        DefinitionDiagnosticCode.NormalizedOutputLimitExceeded or
        DefinitionDiagnosticCode.DiagnosticLimitExceeded => DefinitionDiagnosticStatus.LimitExceeded,
        _ => DefinitionDiagnosticStatus.Rejected
    };

    static int Compare(DefinitionDiagnostic left, DefinitionDiagnostic right)
    {
        var comparison = string.CompareOrdinal(left.LogicalId, right.LogicalId);
        if (comparison != 0) return comparison;
        comparison = string.CompareOrdinal(left.Location, right.Location);
        if (comparison != 0) return comparison;
        comparison = ((int)left.Code).CompareTo((int)right.Code);
        if (comparison != 0) return comparison;
        comparison = string.CompareOrdinal(left.RelatedId, right.RelatedId);
        if (comparison != 0) return comparison;
        comparison = CompareNullable(left.CanonicalCode, right.CanonicalCode);
        return comparison != 0 ? comparison : CompareNullable(left.SchemaCode, right.SchemaCode);
    }

    static int CompareNullable<T>(T? left, T? right)
        where T : struct, Enum
    {
        if (!left.HasValue) return right.HasValue ? -1 : 0;
        return right.HasValue ? Convert.ToInt32(left.Value).CompareTo(Convert.ToInt32(right.Value)) : 1;
    }
}
