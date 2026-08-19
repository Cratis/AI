// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation.Conformance;

static class SchemaValidationVectorManifestValidator
{
    static readonly IReadOnlySet<string> _operations = new HashSet<string>(["load", "validate"], StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _generatorKinds = new HashSet<string>(["aggregateSchemaBytes", "anchorCount", "anchorScalars", "diagnosticCount", "documentCount", "embeddedRootSiblingSchemaNodes", "evaluationPathMultiplicity", "instanceBytes", "instanceDepth", "instanceNodeCount", "instanceStringScalars", "patternAdversarialInput", "patternScalars", "productiveRecursionDepth", "referenceDepth", "referenceEdgeCount", "referenceScalars", "resourceCount", "schemaDepth", "schemaDocumentBytes", "schemaIdScalars", "schemaNodeCount", "uniqueObjectArray", "uniqueObjectArrayLateDuplicate"], StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _instanceGeneratorKinds = new HashSet<string>(["diagnosticCount", "instanceBytes", "instanceDepth", "instanceNodeCount", "instanceStringScalars", "patternAdversarialInput", "productiveRecursionDepth", "uniqueObjectArray", "uniqueObjectArrayLateDuplicate"], StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _targetByteGeneratorKinds = new HashSet<string>(["aggregateSchemaBytes", "instanceBytes", "schemaDocumentBytes", "uniqueObjectArray", "uniqueObjectArrayLateDuplicate"], StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _flags = new HashSet<string>(["adversarial", "boundary", "closure", "committedCorpus", "committedKeyword", "cycle", "determinism", "diagnosticOrder", "format", "malformed", "privacy", "reference", "unicode", "vocabulary"], StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _loadStatuses = new HashSet<string>(["Loaded", "Rejected"], StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _validationStatuses = new HashSet<string>(["Valid", "Invalid", "Rejected", "DiagnosticLimitExceeded", "EvaluationLimitExceeded"], StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _diagnosticStatuses = new HashSet<string>(["Violation", "Rejected", "LimitExceeded"], StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _diagnosticCodes = new HashSet<string>(Enum.GetNames<SchemaDiagnosticCode>(), StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _limitDiagnosticCodes = new HashSet<string>(
        [
            "DocumentLimitExceeded",
            "AggregateSchemaBytesLimitExceeded",
            "CanonicalInputTooLarge",
            "CanonicalOutputTooLarge",
            "CanonicalStringTooLong",
            "CanonicalNestingTooDeep",
            "CanonicalStructuralTokenLimitExceeded",
            "CanonicalArrayItemLimitExceeded",
            "CanonicalObjectMemberLimitExceeded",
            "ResourceLimitExceeded",
            "AnchorLimitExceeded",
            "ReferenceLimitExceeded",
            "ReferenceDepthLimitExceeded",
            "SchemaNodeLimitExceeded",
            "InstanceNodeLimitExceeded",
            "EvaluationWorkLimitExceeded",
            "PatternTooLong",
            "DiagnosticLimitExceeded"
        ],
        StringComparer.Ordinal);
    static readonly IReadOnlySet<string> _keywordSegments = new HashSet<string>(["$anchor", "$defs", "$id", "$ref", "$schema", "$vocabulary", "additionalProperties", "allOf", "anyOf", "const", "contains", "else", "enum", "format", "if", "items", "maxItems", "maxLength", "maximum", "minItems", "minLength", "minimum", "not", "oneOf", "pattern", "properties", "required", "then", "type", "unevaluatedProperties", "uniqueItems"], StringComparer.Ordinal);

    public static void Validate(SchemaValidationVectorManifest manifest, ReadOnlySpan<byte> manifestUtf8)
    {
        if (!IsValidRoot(manifest) ||
            manifest.Cases.Select(_ => _.Id).Distinct(StringComparer.Ordinal).Count() != manifest.Cases.Count ||
            manifest.Documents.Count == 0 ||
            manifest.Documents.Any(_ => string.IsNullOrWhiteSpace(_.Key) || !IsValid(_.Value)) ||
            manifest.Cases.Any(_ => !IsValid(_, manifest.Documents)) ||
            CanonicalJsonSelfHash.Verify(CanonicalJson.Parse(manifestUtf8), CanonicalJsonSelfHashField.ContentHash).Status != CanonicalJsonSelfHashVerificationStatus.Verified)
        {
            throw new InvalidDataException("The schema validation vector manifest contains invalid or incomplete contract data.");
        }
    }

    static bool IsValidRoot(SchemaValidationVectorManifest manifest) =>
        string.Equals(manifest.ProtocolVersion, "1", StringComparison.Ordinal) &&
        string.Equals(manifest.Algorithm, "factory-json-schema-validation-v1", StringComparison.Ordinal) &&
        Sha256Hash.TryParse(manifest.ContentHash, out _) &&
        !string.IsNullOrWhiteSpace(manifest.Description) &&
        manifest.Limits.MaximumDocuments == SchemaValidationLimits.MaximumDocuments &&
        manifest.Limits.MaximumAggregateSchemaBytes == SchemaValidationLimits.MaximumAggregateSchemaBytes &&
        manifest.Limits.MaximumResources == SchemaValidationLimits.MaximumResources &&
        manifest.Limits.MaximumAnchors == SchemaValidationLimits.MaximumAnchors &&
        manifest.Limits.MaximumReferenceEdges == SchemaValidationLimits.MaximumReferenceEdges &&
        manifest.Limits.MaximumReferenceDepth == SchemaValidationLimits.MaximumReferenceDepth &&
        manifest.Limits.MaximumSchemaNodes == SchemaValidationLimits.MaximumSchemaNodes &&
        manifest.Limits.MaximumInstanceNodes == SchemaValidationLimits.MaximumInstanceNodes &&
        manifest.Limits.MaximumEvaluationWorkUnits == SchemaValidationLimits.MaximumEvaluationWorkUnits &&
        manifest.Limits.MaximumDiagnosticInstanceNodes == SchemaValidationLimits.MaximumDiagnosticInstanceNodes &&
        manifest.Limits.MaximumDiagnosticWorkUnits == SchemaValidationLimits.MaximumDiagnosticWorkUnits &&
        manifest.Limits.MaximumDiagnostics == SchemaValidationLimits.MaximumDiagnostics &&
        manifest.Limits.MaximumPatternScalars == SchemaValidationLimits.MaximumPatternScalars &&
        manifest.Limits.MaximumSchemaIdScalars == SchemaValidationLimits.MaximumSchemaIdScalars &&
        manifest.Limits.MaximumReferenceScalars == SchemaValidationLimits.MaximumReferenceScalars &&
        manifest.Limits.MaximumAnchorScalars == SchemaValidationLimits.MaximumAnchorScalars &&
        manifest.GeneratorContract.Count == _generatorKinds.Count &&
        _generatorKinds.All(kind => manifest.GeneratorContract.TryGetValue(kind, out var description) && !string.IsNullOrWhiteSpace(description)) &&
        manifest.Cases.Count > 0;

    static bool IsValid(SchemaValidationVector vector, IReadOnlyDictionary<string, SchemaValidationVectorDocument> documents)
    {
        if (string.IsNullOrWhiteSpace(vector.Id) ||
            !_operations.Contains(vector.Operation) ||
            (vector.SchemaDocuments is null) == (vector.SchemaGenerator is null) ||
            vector.RepeatCount is < 2 or > 100 ||
            vector.ParallelCount is < 2 or > 64 ||
            vector.Flags.Count == 0 ||
            !vector.Flags.All(_flags.Contains) ||
            vector.Flags.Distinct(StringComparer.Ordinal).Count() != vector.Flags.Count ||
            vector.ForbiddenDiagnosticSubstrings.Any(string.IsNullOrEmpty))
        {
            return false;
        }

        if (vector.SchemaDocuments is not null &&
            ((vector.SchemaDocuments.Count == 0 && !string.Equals(vector.Operation, "load", StringComparison.Ordinal)) ||
             vector.SchemaDocuments.Any(_ => string.IsNullOrWhiteSpace(_) || !documents.ContainsKey(_))))
        {
            return false;
        }

        return (vector.SchemaGenerator is null || IsValid(vector.SchemaGenerator, instance: false)) &&
               IsValidOperation(vector) &&
               IsValidExpected(vector.Expected);
    }

    static bool IsValid(SchemaValidationVectorDocument document) =>
        document.LogicalId?.Any(char.IsControl) is false &&
        document.InputBase64 is not null &&
        TryDecode(document.InputBase64);

    static bool IsValid(SchemaValidationVectorGenerator generator, bool instance) =>
        _generatorKinds.Contains(generator.Kind) &&
        generator.Count > 0 &&
        instance == _instanceGeneratorKinds.Contains(generator.Kind) &&
        (instance
            ? generator.SchemaIdPrefix is null
            : Uri.TryCreate(generator.SchemaIdPrefix, UriKind.Absolute, out _)) &&
        (_targetByteGeneratorKinds.Contains(generator.Kind)
            ? generator.TargetBytes > 0
            : generator.TargetBytes is null);

    static bool IsValidOperation(SchemaValidationVector vector)
    {
        if (string.Equals(vector.Operation, "load", StringComparison.Ordinal))
        {
            return vector.RootSchemaId is null && vector.InstanceBase64 is null && vector.InstanceGenerator is null && vector.Expected.ValidationStatus is null;
        }

        return Uri.TryCreate(vector.RootSchemaId, UriKind.Absolute, out _) &&
               (vector.InstanceBase64 is null) != (vector.InstanceGenerator is null) &&
               (vector.InstanceBase64 is null || TryDecode(vector.InstanceBase64)) &&
               (vector.InstanceGenerator is null || IsValid(vector.InstanceGenerator, instance: true)) &&
               vector.Expected.ValidationStatus is not null;
    }

    static bool IsValidExpected(SchemaValidationVectorExpected expected)
    {
        if (!_loadStatuses.Contains(expected.LoadStatus) ||
            string.Equals(expected.LoadStatus, "Loaded", StringComparison.Ordinal) != (expected.SchemaSet is not null) ||
            (expected.SchemaSet is not null && !IsValid(expected.SchemaSet)) ||
            (expected.ValidationStatus is not null && !_validationStatuses.Contains(expected.ValidationStatus)) ||
            (expected.ValidationStatus is null && expected.Closure is not null) ||
            (expected.Closure is not null && !IsValid(expected.Closure)) ||
            (!string.Equals(expected.LoadStatus, "Loaded", StringComparison.Ordinal) && expected.ValidationStatus is not null) ||
            (string.Equals(expected.ValidationStatus, "Valid", StringComparison.Ordinal) && expected.Diagnostics.Count != 0) ||
            !expected.Diagnostics.All(IsValid) ||
            !IsOrderedAndDistinct(expected.Diagnostics))
        {
            return false;
        }

        return expected.ValidationStatus is null ||
               string.Equals(expected.ValidationStatus, "Rejected", StringComparison.Ordinal) ||
               expected.Closure is not null;
    }

    static bool IsValid(SchemaValidationVectorSet set) =>
        Sha256Hash.TryParse(set.Identity, out _) &&
        IsValid(set.Documents) &&
        set.Resources.All(IsValid) &&
        set.Resources.Select(_ => _.SchemaId).Distinct(StringComparer.Ordinal).Count() == set.Resources.Count &&
        set.Resources.Select(_ => _.SchemaId).SequenceEqual(set.Resources.Select(_ => _.SchemaId).Order(StringComparer.Ordinal), StringComparer.Ordinal) &&
        set.Resources.All(resource => set.Documents.Any(document =>
            string.Equals(document.SchemaId, resource.DocumentId, StringComparison.Ordinal) &&
            document.ContentHash == resource.ContentHash)) &&
        set.Documents.All(document => document.ReferenceCount == set.Resources
            .Where(resource => string.Equals(resource.DocumentId, document.SchemaId, StringComparison.Ordinal))
            .Sum(resource => resource.ReferenceCount)) &&
        set.ResourceCount == set.Resources.Count &&
        set.AnchorCount >= 0 &&
        set.ReferenceCount == set.Resources.Sum(_ => _.ReferenceCount);

    static bool IsValid(SchemaValidationVectorClosure closure) =>
        Uri.TryCreate(closure.RootSchemaId, UriKind.Absolute, out _) &&
        Sha256Hash.TryParse(closure.Identity, out _) &&
        IsValid(closure.Members) &&
        closure.ResourceCount >= closure.Members.Count &&
        closure.AnchorCount >= 0 &&
        closure.ReferenceCount == closure.Members.Sum(_ => _.ReferenceCount);

    static bool IsValid(IReadOnlyList<SchemaValidationVectorMember> members) =>
        members.Count > 0 &&
        members.All(IsValid) &&
        members.Select(_ => _.SchemaId).Distinct(StringComparer.Ordinal).Count() == members.Count &&
        members.Select(_ => _.SchemaId).SequenceEqual(members.Select(_ => _.SchemaId).Order(StringComparer.Ordinal), StringComparer.Ordinal);

    static bool IsValid(SchemaValidationVectorMember member) =>
        Uri.TryCreate(member.SchemaId, UriKind.Absolute, out _) &&
        Sha256Hash.TryParse(member.ContentHash, out _) &&
        member.ReferenceCount >= 0;

    static bool IsValid(SchemaValidationVectorResource resource) =>
        Uri.TryCreate(resource.SchemaId, UriKind.Absolute, out _) &&
        Uri.TryCreate(resource.DocumentId, UriKind.Absolute, out _) &&
        Sha256Hash.TryParse(resource.ContentHash, out _) &&
        resource.ReferenceCount >= 0;

    static bool IsValid(SchemaValidationVectorDiagnostic diagnostic) =>
        _diagnosticCodes.Contains(diagnostic.Code) &&
        string.Equals(diagnostic.Severity, "Error", StringComparison.Ordinal) &&
        _diagnosticStatuses.Contains(diagnostic.Status) &&
        (_limitDiagnosticCodes.Contains(diagnostic.Code) == string.Equals(diagnostic.Status, "LimitExceeded", StringComparison.Ordinal)) &&
        (diagnostic.SchemaId is null || Uri.TryCreate(diagnostic.SchemaId, UriKind.Absolute, out _)) &&
        IsSafeLocation(diagnostic.InstanceLocation, allowKeywordSegments: false) &&
        IsSafeLocation(diagnostic.KeywordLocation, allowKeywordSegments: true);

    static bool IsSafeLocation(string location, bool allowKeywordSegments)
    {
        if (string.Equals(location, "#", StringComparison.Ordinal))
        {
            return true;
        }

        if (!location.StartsWith("#/", StringComparison.Ordinal) ||
            location.Any(char.IsControl) ||
            location.Contains("..", StringComparison.Ordinal))
        {
            return false;
        }

        return location.Split('/').Skip(1).All(segment => IsSafeLocationSegment(segment, allowKeywordSegments));
    }

    static bool IsSafeLocationSegment(string segment, bool allowKeywordSegments)
    {
        if (int.TryParse(segment, out var index) && index >= 0)
        {
            return true;
        }

        if (allowKeywordSegments && _keywordSegments.Contains(segment))
        {
            return true;
        }

        return segment.Length == 65 &&
               segment[0] == '@' &&
               segment.Skip(1).All(IsLowercaseHex);
    }

    static bool IsLowercaseHex(char character) =>
        (character >= '0' && character <= '9') ||
        (character >= 'a' && character <= 'f');

    static bool IsOrderedAndDistinct(IReadOnlyList<SchemaValidationVectorDiagnostic> diagnostics)
    {
        var ordered = diagnostics
            .OrderBy(_ => _.SchemaId, StringComparer.Ordinal)
            .ThenBy(_ => _.InstanceLocation, StringComparer.Ordinal)
            .ThenBy(_ => _.KeywordLocation, StringComparer.Ordinal)
            .ThenBy(_ => Enum.Parse<SchemaDiagnosticCode>(_.Code))
            .ThenBy(_ => Enum.Parse<SchemaDiagnosticStatus>(_.Status))
            .ThenBy(_ => Enum.Parse<SchemaDiagnosticSeverity>(_.Severity));
        return diagnostics.SequenceEqual(ordered) && diagnostics.Distinct().Count() == diagnostics.Count;
    }

    static bool TryDecode(string value)
    {
        var buffer = new byte[value.Length];
        return Convert.TryFromBase64String(value, buffer, out _);
    }
}
