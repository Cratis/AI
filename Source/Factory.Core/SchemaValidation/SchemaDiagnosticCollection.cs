// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.ObjectModel;

namespace Cratis.Factory.SchemaValidation;

sealed class SchemaDiagnosticCollection
{
    readonly List<SchemaDiagnostic> _diagnostics = [];
    int _count;

    public bool HasDiagnostics => _count > 0;

    public bool LimitExceeded => _count > SchemaValidationLimits.MaximumDiagnostics;

    public void Add(
        SchemaDiagnosticCode code,
        SchemaDiagnosticStatus? status = null,
        string? schemaId = null,
        string instanceLocation = "#",
        string keywordLocation = "#")
    {
        _count++;
        if (_diagnostics.Count < SchemaValidationLimits.MaximumDiagnostics)
        {
            _diagnostics.Add(new(
                code,
                SchemaDiagnosticSeverity.Error,
                status ?? DefaultStatusFor(code),
                schemaId,
                instanceLocation,
                keywordLocation));
        }
    }

    public IReadOnlyList<SchemaDiagnostic> ToReadOnly(string? schemaIdForLimit = null)
    {
        _diagnostics.Sort(SchemaDiagnosticComparer.Instance);
        if (LimitExceeded)
        {
            var limitDiagnostic = new SchemaDiagnostic(
                SchemaDiagnosticCode.DiagnosticLimitExceeded,
                SchemaDiagnosticSeverity.Error,
                SchemaDiagnosticStatus.LimitExceeded,
                schemaIdForLimit,
                "#",
                "#");
            if (_diagnostics.Count == SchemaValidationLimits.MaximumDiagnostics)
            {
                _diagnostics[^1] = limitDiagnostic;
            }
            else
            {
                _diagnostics.Add(limitDiagnostic);
            }

            _diagnostics.Sort(SchemaDiagnosticComparer.Instance);
        }

        return new ReadOnlyCollection<SchemaDiagnostic>([.. _diagnostics]);
    }

    static SchemaDiagnosticStatus DefaultStatusFor(SchemaDiagnosticCode code) => code switch
    {
        SchemaDiagnosticCode.DocumentLimitExceeded or
        SchemaDiagnosticCode.AggregateSchemaBytesLimitExceeded or
        SchemaDiagnosticCode.CanonicalInputTooLarge or
        SchemaDiagnosticCode.CanonicalOutputTooLarge or
        SchemaDiagnosticCode.CanonicalStringTooLong or
        SchemaDiagnosticCode.CanonicalNestingTooDeep or
        SchemaDiagnosticCode.CanonicalStructuralTokenLimitExceeded or
        SchemaDiagnosticCode.CanonicalArrayItemLimitExceeded or
        SchemaDiagnosticCode.CanonicalObjectMemberLimitExceeded or
        SchemaDiagnosticCode.ResourceLimitExceeded or
        SchemaDiagnosticCode.AnchorLimitExceeded or
        SchemaDiagnosticCode.ReferenceLimitExceeded or
        SchemaDiagnosticCode.ReferenceDepthLimitExceeded or
        SchemaDiagnosticCode.SchemaNodeLimitExceeded or
        SchemaDiagnosticCode.InstanceNodeLimitExceeded or
        SchemaDiagnosticCode.EvaluationWorkLimitExceeded or
        SchemaDiagnosticCode.PatternTooLong or
        SchemaDiagnosticCode.DiagnosticLimitExceeded => SchemaDiagnosticStatus.LimitExceeded,
        _ => SchemaDiagnosticStatus.Rejected
    };

    sealed class SchemaDiagnosticComparer : IComparer<SchemaDiagnostic>
    {
        public static SchemaDiagnosticComparer Instance { get; } = new();

        public int Compare(SchemaDiagnostic? x, SchemaDiagnostic? y)
        {
            if (ReferenceEquals(x, y)) return 0;
            if (x is null) return -1;
            if (y is null) return 1;

            var comparison = string.CompareOrdinal(x.SchemaId, y.SchemaId);
            if (comparison != 0) return comparison;
            comparison = string.CompareOrdinal(x.InstanceLocation, y.InstanceLocation);
            if (comparison != 0) return comparison;
            comparison = string.CompareOrdinal(x.KeywordLocation, y.KeywordLocation);
            if (comparison != 0) return comparison;
            comparison = x.Code.CompareTo(y.Code);
            if (comparison != 0) return comparison;
            comparison = x.Status.CompareTo(y.Status);
            if (comparison != 0) return comparison;

            return x.Severity.CompareTo(y.Severity);
        }
    }
}
