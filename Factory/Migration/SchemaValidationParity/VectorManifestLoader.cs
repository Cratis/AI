// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using System.Text.Json;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Hashing;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.SchemaValidationParity;

static class VectorManifestLoader
{
    static readonly HashSet<string> _operations = new(["load", "validate"], StringComparer.Ordinal);
    static readonly HashSet<string> _generatorKinds = new(
        ["aggregateSchemaBytes", "anchorCount", "anchorScalars", "diagnosticCount", "documentCount", "embeddedRootSiblingSchemaNodes", "evaluationPathMultiplicity", "instanceBytes", "instanceDepth", "instanceNodeCount", "instanceStringScalars", "patternAdversarialInput", "patternScalars", "productiveRecursionDepth", "referenceDepth", "referenceEdgeCount", "referenceScalars", "resourceCount", "schemaDepth", "schemaDocumentBytes", "schemaIdScalars", "schemaNodeCount", "uniqueObjectArray", "uniqueObjectArrayLateDuplicate"],
        StringComparer.Ordinal);
    static readonly HashSet<string> _instanceGeneratorKinds = new(
        ["diagnosticCount", "instanceBytes", "instanceDepth", "instanceNodeCount", "instanceStringScalars", "patternAdversarialInput", "productiveRecursionDepth", "uniqueObjectArray", "uniqueObjectArrayLateDuplicate"],
        StringComparer.Ordinal);
    static readonly HashSet<string> _targetByteGeneratorKinds = new(
        ["aggregateSchemaBytes", "instanceBytes", "schemaDocumentBytes", "uniqueObjectArray", "uniqueObjectArrayLateDuplicate"],
        StringComparer.Ordinal);
    static readonly HashSet<string> _flags = new(
        ["adversarial", "boundary", "closure", "committedCorpus", "committedKeyword", "cycle", "determinism", "diagnosticOrder", "format", "malformed", "privacy", "reference", "unicode", "vocabulary"],
        StringComparer.Ordinal);
    static readonly HashSet<string> _loadStatuses = new(["Loaded", "Rejected"], StringComparer.Ordinal);
    static readonly HashSet<string> _validationStatuses = new(["Valid", "Invalid", "Rejected", "DiagnosticLimitExceeded", "EvaluationLimitExceeded"], StringComparer.Ordinal);
    static readonly HashSet<string> _diagnosticStatuses = new(["Violation", "Rejected", "LimitExceeded"], StringComparer.Ordinal);
    static readonly HashSet<string> _diagnosticCodes = new(Enum.GetNames<SchemaDiagnosticCode>(), StringComparer.Ordinal);
    static readonly HashSet<string> _safeKeywordSegments = new(
        ["$anchor", "$comment", "$defs", "$id", "$ref", "$schema", "$vocabulary", "additionalProperties", "allOf", "anyOf", "const", "contains", "description", "else", "enum", "format", "if", "items", "maxItems", "maxLength", "maximum", "minItems", "minLength", "minimum", "not", "oneOf", "pattern", "properties", "required", "then", "title", "type", "unevaluatedProperties", "uniqueItems"],
        StringComparer.Ordinal);

    public static (VectorManifest Manifest, VectorCase[] Cases) Load(byte[] utf8)
    {
        StrictManifestShape.Validate(utf8);
        var manifest = JsonSerializer.Deserialize<VectorManifest>(utf8, ParityJson.Options) ??
                       throw new InvalidVectorManifest();
        ValidateRoot(manifest);
        var cases = manifest.Cases!.Select(_ => _ ?? throw Invalid()).ToArray();
        if (cases.Select(_ => _.Id).Distinct(StringComparer.Ordinal).Count() != cases.Length)
        {
            throw Invalid();
        }

        foreach (var document in manifest.Documents!)
        {
            if (string.IsNullOrWhiteSpace(document.Key) || !IsValid(document.Value))
            {
                throw Invalid();
            }
        }

        foreach (var vector in cases)
        {
            Validate(vector, manifest.Documents);
        }

        var verification = CanonicalJsonSelfHash.Verify(CanonicalJson.Parse(utf8), CanonicalJsonSelfHashField.ContentHash);
        if (verification.Status != CanonicalJsonSelfHashVerificationStatus.Verified)
        {
            throw Invalid();
        }

        return (manifest, cases);
    }

    static void ValidateRoot(VectorManifest manifest)
    {
        var limits = manifest.Limits;
        var generators = manifest.GeneratorContract;
        if (!string.Equals(manifest.ProtocolVersion, "1", StringComparison.Ordinal) ||
            !string.Equals(manifest.Algorithm, "factory-json-schema-validation-v1", StringComparison.Ordinal) ||
            !Sha256Hash.TryParse(manifest.ContentHash, out _) ||
            string.IsNullOrWhiteSpace(manifest.Description) ||
            limits is null ||
            limits.MaximumDocuments != SchemaValidationLimits.MaximumDocuments ||
            limits.MaximumAggregateSchemaBytes != SchemaValidationLimits.MaximumAggregateSchemaBytes ||
            limits.MaximumResources != SchemaValidationLimits.MaximumResources ||
            limits.MaximumAnchors != SchemaValidationLimits.MaximumAnchors ||
            limits.MaximumReferenceEdges != SchemaValidationLimits.MaximumReferenceEdges ||
            limits.MaximumReferenceDepth != SchemaValidationLimits.MaximumReferenceDepth ||
            limits.MaximumSchemaNodes != SchemaValidationLimits.MaximumSchemaNodes ||
            limits.MaximumInstanceNodes != SchemaValidationLimits.MaximumInstanceNodes ||
            limits.MaximumEvaluationWorkUnits != SchemaValidationLimits.MaximumEvaluationWorkUnits ||
            limits.MaximumDiagnosticInstanceNodes != SchemaValidationLimits.MaximumDiagnosticInstanceNodes ||
            limits.MaximumDiagnosticWorkUnits != SchemaValidationLimits.MaximumDiagnosticWorkUnits ||
            limits.MaximumDiagnostics != SchemaValidationLimits.MaximumDiagnostics ||
            limits.MaximumPatternScalars != SchemaValidationLimits.MaximumPatternScalars ||
            limits.MaximumSchemaIdScalars != SchemaValidationLimits.MaximumSchemaIdScalars ||
            limits.MaximumReferenceScalars != SchemaValidationLimits.MaximumReferenceScalars ||
            limits.MaximumAnchorScalars != SchemaValidationLimits.MaximumAnchorScalars ||
            generators is null ||
            generators.Count != _generatorKinds.Count ||
            manifest.Documents is not { Count: > 0 } ||
            manifest.Cases is not { Count: > 0 })
        {
            throw Invalid();
        }

        foreach (var kind in _generatorKinds)
        {
            if (!generators.TryGetValue(kind, out var description) || string.IsNullOrWhiteSpace(description))
            {
                throw Invalid();
            }
        }
    }

    static void Validate(VectorCase vector, IReadOnlyDictionary<string, VectorDocument> documents)
    {
        if (string.IsNullOrWhiteSpace(vector.Id) ||
            vector.Operation is null ||
            !_operations.Contains(vector.Operation) ||
            vector.RepeatCount is not (>= 2 and <= 100) ||
            vector.ParallelCount is not (>= 2 and <= 64) ||
            vector.Flags is not { Count: > 0 } ||
            vector.Flags.Any(_ => !_flags.Contains(_)) ||
            vector.Flags.Distinct(StringComparer.Ordinal).Count() != vector.Flags.Count ||
            vector.Expected is null)
        {
            throw Invalid();
        }

        var forbiddenSubstrings = vector.ForbiddenDiagnosticSubstrings;
        if (forbiddenSubstrings is not { } presentForbiddenSubstrings || presentForbiddenSubstrings.Any(string.IsNullOrEmpty))
        {
            throw Invalid();
        }

        var hasDocumentKeys = vector.SchemaDocuments is not null;
        var hasGenerator = vector.SchemaGenerator is not null;
        if (hasDocumentKeys == hasGenerator ||
            vector.SchemaDocuments?.Any(_ => string.IsNullOrWhiteSpace(_) || !documents.ContainsKey(_)) == true)
        {
            throw Invalid();
        }
        if (vector.SchemaGenerator is { } schemaGenerator && !IsValid(schemaGenerator, false))
        {
            throw Invalid();
        }

        ValidateOperation(vector);
        ValidateExpected(vector.Expected);
    }

    static void ValidateOperation(VectorCase vector)
    {
        if (string.Equals(vector.Operation, "load", StringComparison.Ordinal))
        {
            if (vector.RootSchemaId is not null ||
                vector.InstanceBase64 is not null ||
                vector.InstanceGenerator is not null ||
                vector.Expected!.ValidationStatus is not null)
            {
                throw Invalid();
            }
            return;
        }

        var hasInstanceBytes = vector.InstanceBase64 is not null;
        var hasInstanceGenerator = vector.InstanceGenerator is not null;
        if (!IsAbsoluteIdentifier(vector.RootSchemaId) ||
            hasInstanceBytes == hasInstanceGenerator ||
            (hasInstanceBytes && !TryDecode(vector.InstanceBase64)) ||
            (hasInstanceGenerator && !IsValid(vector.InstanceGenerator!, true)) ||
            vector.Expected!.ValidationStatus is null)
        {
            throw Invalid();
        }
    }

    static void ValidateExpected(VectorExpected expected)
    {
        var diagnostics = expected.Diagnostics;
        var diagnosticsAreInvalid = diagnostics?.Any(_ => _ is null || !IsValid(_)) != false;
        if (expected.LoadStatus is null ||
            !_loadStatuses.Contains(expected.LoadStatus) ||
            string.Equals(expected.LoadStatus, "Loaded", StringComparison.Ordinal) != (expected.SchemaSet is not null) ||
            (expected.SchemaSet is not null && !IsValid(expected.SchemaSet)) ||
            (expected.ValidationStatus is not null && !_validationStatuses.Contains(expected.ValidationStatus)) ||
            (expected.ValidationStatus is null && expected.Closure is not null) ||
            (expected.Closure is not null && !IsValid(expected.Closure)) ||
            (!string.Equals(expected.LoadStatus, "Loaded", StringComparison.Ordinal) && expected.ValidationStatus is not null) ||
            (string.Equals(expected.ValidationStatus, "Valid", StringComparison.Ordinal) && expected.Diagnostics is not { Count: 0 }) ||
            !HasConsistentEnvelope(expected) ||
            (diagnostics is not null && !IsStrictlyOrdered(diagnostics, CompareDiagnostics)) ||
            diagnosticsAreInvalid ||
            (expected.ValidationStatus is not null &&
             !string.Equals(expected.ValidationStatus, "Rejected", StringComparison.Ordinal) &&
             expected.Closure is null))
        {
            throw Invalid();
        }
    }

    static bool HasConsistentEnvelope(VectorExpected expected)
    {
        if (string.Equals(expected.LoadStatus, "Rejected", StringComparison.Ordinal))
        {
            return expected.Diagnostics is { Count: > 0 } &&
                   expected.Diagnostics.All(_ =>
                       string.Equals(_!.Status, "Rejected", StringComparison.Ordinal) ||
                       string.Equals(_.Status, "LimitExceeded", StringComparison.Ordinal));
        }
        if (expected.ValidationStatus is null) return expected.Diagnostics is { Count: 0 };
        return expected.ValidationStatus switch
        {
            "Valid" => expected.Diagnostics is { Count: 0 },
            "Invalid" => expected.Diagnostics is { Count: > 0 } &&
                         expected.Diagnostics.All(_ => string.Equals(_!.Status, "Violation", StringComparison.Ordinal)),
            "DiagnosticLimitExceeded" =>
                (expected.Diagnostics is { Count: SchemaValidationLimits.MaximumDiagnostics } &&
                 expected.Diagnostics.Count(_ =>
                     string.Equals(_!.Code, nameof(SchemaDiagnosticCode.DiagnosticLimitExceeded), StringComparison.Ordinal) &&
                     string.Equals(_.Status, "LimitExceeded", StringComparison.Ordinal)) == 1) ||
                (expected.Diagnostics is { Count: 1 } &&
                 string.Equals(expected.Diagnostics[0]!.Code, nameof(SchemaDiagnosticCode.DiagnosticLimitExceeded), StringComparison.Ordinal) &&
                 string.Equals(expected.Diagnostics[0]!.Status, "LimitExceeded", StringComparison.Ordinal)),
            "EvaluationLimitExceeded" => expected.Diagnostics is { Count: 1 } &&
                                         (string.Equals(expected.Diagnostics[0]!.Code, nameof(SchemaDiagnosticCode.InstanceNodeLimitExceeded), StringComparison.Ordinal) ||
                                          string.Equals(expected.Diagnostics[0]!.Code, nameof(SchemaDiagnosticCode.EvaluationWorkLimitExceeded), StringComparison.Ordinal)) &&
                                         string.Equals(expected.Diagnostics[0]!.Status, "LimitExceeded", StringComparison.Ordinal),
            "Rejected" => expected.Diagnostics is { Count: > 0 } &&
                          expected.Diagnostics.All(_ =>
                              string.Equals(_!.Status, "Rejected", StringComparison.Ordinal) ||
                              string.Equals(_.Status, "LimitExceeded", StringComparison.Ordinal)),
            _ => false
        };
    }

    static bool IsValid(VectorDocument document) =>
        document.LogicalId is not null && TryDecode(document.InputBase64);

    static bool IsValid(VectorGenerator generator, bool instance)
    {
        return generator.Kind is not null &&
               _generatorKinds.Contains(generator.Kind) &&
               generator.Count is > 0 &&
               _instanceGeneratorKinds.Contains(generator.Kind) == instance &&
               (instance
                   ? generator.SchemaIdPrefix is null
                   : Uri.TryCreate(generator.SchemaIdPrefix, UriKind.Absolute, out _)) &&
               (_targetByteGeneratorKinds.Contains(generator.Kind)
                   ? generator.TargetBytes is > 0
                   : generator.TargetBytes is null);
    }

    static bool IsValid(VectorSet set)
    {
        var resources = set.Resources;
        if (!Sha256Hash.TryParse(set.Identity, out _) ||
            !IsValid(set.Documents) ||
            resources is not { } presentResources ||
            presentResources.Any(_ => _ is null || !IsValid(_)) ||
            set.ResourceCount != presentResources.Count ||
            set.ResourceCount > SchemaValidationLimits.MaximumResources ||
            set.AnchorCount is not (>= 0 and <= SchemaValidationLimits.MaximumAnchors) ||
            set.ReferenceCount is not (>= 0 and <= SchemaValidationLimits.MaximumReferenceEdges) ||
            set.Documents!.Sum(_ => _!.ReferenceCount) != set.ReferenceCount ||
            presentResources.Sum(_ => _!.ReferenceCount) != set.ReferenceCount)
        {
            return false;
        }
        var documentMap = set.Documents!.ToDictionary(_ => _!.SchemaId!, StringComparer.Ordinal);
        return presentResources.Select(_ => _!.SchemaId).Distinct(StringComparer.Ordinal).Count() == presentResources.Count &&
               presentResources.Select(_ => _!.SchemaId)
                   .SequenceEqual(presentResources.Select(_ => _!.SchemaId).Order(StringComparer.Ordinal), StringComparer.Ordinal) &&
               presentResources.All(resource =>
                   documentMap.TryGetValue(resource!.DocumentId!, out var document) &&
                   string.Equals(resource.ContentHash, document!.ContentHash, StringComparison.Ordinal));
    }

    static bool IsValid(VectorClosure closure) =>
        IsAbsoluteIdentifier(closure.RootSchemaId) &&
        Sha256Hash.TryParse(closure.Identity, out _) &&
        IsValid(closure.Members) &&
        closure.ResourceCount >= closure.Members!.Count &&
        closure.ResourceCount <= SchemaValidationLimits.MaximumResources &&
        closure.AnchorCount is >= 0 and <= SchemaValidationLimits.MaximumAnchors &&
        closure.ReferenceCount is >= 0 and <= SchemaValidationLimits.MaximumReferenceEdges &&
        closure.Members.Sum(_ => _!.ReferenceCount) == closure.ReferenceCount;

    static bool IsValid(IReadOnlyList<VectorMember?>? members)
    {
        if (members is null || members.Count == 0)
        {
            return false;
        }
        if (members.Any(member => member is null || !IsAbsoluteIdentifier(member.SchemaId) || !Sha256Hash.TryParse(member.ContentHash, out _) || member.ReferenceCount is not >= 0))
        {
            return false;
        }
        return members.Select(_ => _!.SchemaId)
                   .Distinct(StringComparer.Ordinal).Count() == members.Count &&
               members.Select(_ => _!.SchemaId)
                   .SequenceEqual(members.Select(_ => _!.SchemaId).Order(StringComparer.Ordinal), StringComparer.Ordinal);
    }

    static bool IsValid(VectorResource resource) =>
        IsAbsoluteIdentifier(resource.SchemaId) &&
        IsAbsoluteIdentifier(resource.DocumentId) &&
        Sha256Hash.TryParse(resource.ContentHash, out _) &&
        resource.ReferenceCount is >= 0 and <= SchemaValidationLimits.MaximumReferenceEdges;

    static bool IsValid(VectorDiagnostic diagnostic) =>
        diagnostic.Code is not null &&
        _diagnosticCodes.Contains(diagnostic.Code) &&
        string.Equals(diagnostic.Severity, "Error", StringComparison.Ordinal) &&
        diagnostic.Status is not null &&
        _diagnosticStatuses.Contains(diagnostic.Status) &&
        (diagnostic.SchemaId is null || IsAbsoluteIdentifier(diagnostic.SchemaId)) &&
        IsSafeLocation(diagnostic.InstanceLocation, false) &&
        IsSafeLocation(diagnostic.KeywordLocation, true);

    static bool IsSafeLocation(string? location, bool allowKeywordSegments)
    {
        if (string.Equals(location, "#", StringComparison.Ordinal)) return true;
        return location is { } presentLocation &&
               presentLocation.StartsWith("#/", StringComparison.Ordinal) &&
               !presentLocation.Any(char.IsControl) &&
               !presentLocation.Contains("..", StringComparison.Ordinal) &&
               presentLocation.Split('/').Skip(1).All(segment => IsSafeSegment(segment, allowKeywordSegments));
    }

    static bool IsSafeSegment(string value, bool allowKeywordSegments)
    {
        if (value.Length > 0 &&
            (value.Length == 1 || value[0] != '0') &&
            value.All(character => character is >= '0' and <= '9'))
        {
            return true;
        }
        if (allowKeywordSegments && _safeKeywordSegments.Contains(value)) return true;
        if (value.Length != 65 || value[0] != '@') return false;
        foreach (var character in value.AsSpan(1))
        {
            if (character is not (>= '0' and <= '9') and not (>= 'a' and <= 'f')) return false;
        }
        return true;
    }

    static bool IsAbsoluteIdentifier(string? value)
    {
        if (string.IsNullOrEmpty(value) ||
            value.EnumerateRunes().Count() > SchemaValidationLimits.MaximumSchemaIdScalars ||
            value.Any(character => char.IsControl(character) || char.IsWhiteSpace(character) || character > '\u007e') ||
            !Uri.TryCreate(value, UriKind.Absolute, out var identifier))
        {
            return false;
        }
        return string.Equals(identifier.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
               string.IsNullOrEmpty(identifier.Fragment) &&
               string.IsNullOrEmpty(identifier.Query) &&
               string.IsNullOrEmpty(identifier.UserInfo);
    }

    static int CompareDiagnostics(VectorDiagnostic? left, VectorDiagnostic? right)
    {
        if (left is null || right is null) return left is null ? -1 : 1;
        var comparison = string.CompareOrdinal(left.SchemaId, right.SchemaId);
        if (comparison != 0) return comparison;
        comparison = string.CompareOrdinal(left.InstanceLocation, right.InstanceLocation);
        if (comparison != 0) return comparison;
        comparison = string.CompareOrdinal(left.KeywordLocation, right.KeywordLocation);
        if (comparison != 0) return comparison;
        _ = Enum.TryParse<SchemaDiagnosticCode>(left.Code, out var leftCode);
        _ = Enum.TryParse<SchemaDiagnosticCode>(right.Code, out var rightCode);
        comparison = leftCode.CompareTo(rightCode);
        if (comparison != 0) return comparison;
        _ = Enum.TryParse<SchemaDiagnosticStatus>(left.Status, out var leftStatus);
        _ = Enum.TryParse<SchemaDiagnosticStatus>(right.Status, out var rightStatus);
        comparison = leftStatus.CompareTo(rightStatus);
        return comparison != 0 ? comparison : string.CompareOrdinal(left.Severity, right.Severity);
    }

    static bool IsStrictlyOrdered<T>(IReadOnlyList<T> values, Func<T, T, int> compare)
    {
        for (var index = 1; index < values.Count; index++)
        {
            if (compare(values[index - 1], values[index]) >= 0) return false;
        }
        return true;
    }

    static bool TryDecode(string? value)
    {
        if (value is null) return false;
        var buffer = new byte[value.Length];
        return Convert.TryFromBase64String(value, buffer, out _);
    }

    static InvalidVectorManifest Invalid() => new("manifest-contract-invalid");
}
