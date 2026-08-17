// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Conformance;

static class CanonicalJsonVectorManifestValidator
{
    public static void Validate(CanonicalJsonVectorManifest manifest)
    {
        if (!IsValidRoot(manifest) ||
            manifest.Cases.Select(_ => _.Id).Distinct(StringComparer.Ordinal).Count() != manifest.Cases.Count ||
            manifest.Cases.Any(vector => !IsValid(vector)))
        {
            throw new InvalidDataException("The canonical JSON vector manifest contains invalid or incomplete contract data.");
        }
    }

    static bool IsValidRoot(CanonicalJsonVectorManifest manifest) =>
        string.Equals(manifest.ProtocolVersion, "1", StringComparison.Ordinal) &&
        string.Equals(manifest.Algorithm, "factory-canonical-json-v1", StringComparison.Ordinal) &&
        Sha256Hash.TryParse(manifest.ContentHash, out _) &&
        !string.IsNullOrWhiteSpace(manifest.Description) &&
        IsValidLimits(manifest.Limits) &&
        manifest.GeneratorContract.Count == CanonicalJsonVectorVocabulary.GeneratorKinds.Count &&
        CanonicalJsonVectorVocabulary.GeneratorKinds.All(kind => manifest.GeneratorContract.TryGetValue(kind, out var description) && !string.IsNullOrWhiteSpace(description)) &&
        manifest.Cases.Count > 0;

    static bool IsValidLimits(CanonicalJsonVectorLimits limits) =>
        limits.MaximumInputBytes == CanonicalJsonLimits.MaximumInputBytes &&
        limits.MaximumOutputBytes == CanonicalJsonLimits.MaximumCanonicalBytes &&
        limits.MaximumDepth == CanonicalJsonLimits.MaximumNestingDepth &&
        limits.MaximumStringScalars == CanonicalJsonLimits.MaximumStringScalars &&
        limits.MaximumKeyScalars == CanonicalJsonLimits.MaximumStringScalars &&
        limits.MaximumStructuralPunctuationTokens == CanonicalJsonLimits.MaximumStructuralTokens &&
        limits.MaximumArrayItems == CanonicalJsonLimits.MaximumArrayItems &&
        limits.MaximumObjectMembers == CanonicalJsonLimits.MaximumObjectMembers;

    static bool IsValid(CanonicalJsonVector vector) =>
        !string.IsNullOrWhiteSpace(vector.Id) &&
        vector.RepeatCount is >= 2 and <= 100 &&
        (!vector.AllocationCeilingBytes.HasValue || vector.AllocationCeilingBytes > 0) &&
        CanonicalJsonVectorOperation.IsValid(vector) &&
        (vector.InputBase64 is null) != (vector.Generator is null) &&
        IsValidMetadata(vector) &&
        (vector.Generator is null || CanonicalJsonVectorGeneratorValidator.IsValid(vector)) &&
        IsValidExpected(vector);

    static bool IsValidMetadata(CanonicalJsonVector vector) =>
        vector.Flags is { Count: > 0 } &&
        vector.Flags.All(_ => !string.IsNullOrWhiteSpace(_)) &&
        vector.Flags.All(CanonicalJsonVectorVocabulary.Flags.Contains) &&
        vector.Flags.Distinct(StringComparer.Ordinal).Count() == vector.Flags.Count &&
        vector.ForbiddenErrorSubstrings?.All(_ => !string.IsNullOrEmpty(_)) != false &&
        (vector.EquivalenceGroup is null || !string.IsNullOrWhiteSpace(vector.EquivalenceGroup)) &&
        (vector.DistinctFromGroup is null || !string.IsNullOrWhiteSpace(vector.DistinctFromGroup)) &&
        (vector.SourceHint is null || !string.IsNullOrWhiteSpace(vector.SourceHint)) &&
        (vector.ProjectionHint is null || string.Equals(vector.ProjectionHint, "human", StringComparison.Ordinal) || string.Equals(vector.ProjectionHint, "machine", StringComparison.Ordinal));

    static bool IsValidExpected(CanonicalJsonVector vector)
    {
        var expected = vector.Expected;
        if (!expected.Accepted)
        {
            return expected.ErrorCode is not null &&
                   Enum.GetNames<CanonicalJsonFailureCode>().Contains(expected.ErrorCode, StringComparer.Ordinal) &&
                   (!expected.Position.HasValue || expected.Position >= 0) &&
                   (!expected.Depth.HasValue || expected.Depth >= 0) &&
                   (!HasFlag(vector, "absoluteBytePosition") || expected.Position.HasValue) &&
                   (!HasFlag(vector, "depth") || expected.Depth.HasValue) &&
                   expected.CanonicalBase64 is null &&
                   expected.CanonicalByteLength is null &&
                   expected.CanonicalHash is null &&
                   expected.ByteHash is null &&
                   expected.SelfHash is null &&
                   expected.DeclaredHash is null &&
                   expected.VerificationStatus is null &&
                   expected.CalculationError is null;
        }

        if (!expected.CanonicalByteLength.HasValue ||
            expected.CanonicalByteLength < 0 ||
            !Sha256Hash.TryParse(expected.CanonicalHash, out _) ||
            !IsValidCanonicalBytes(vector, expected) ||
            expected.ErrorCode is not null ||
            expected.Position is not null ||
            expected.Depth is not null)
        {
            return false;
        }

        if (string.Equals(vector.Operation, "byteHash", StringComparison.Ordinal))
        {
            return Sha256Hash.TryParse(expected.ByteHash, out _) &&
                   expected.SelfHash is null &&
                   expected.DeclaredHash is null &&
                   expected.VerificationStatus is null &&
                   expected.CalculationError is null;
        }

        if (CanonicalJsonVectorOperation.IsSelfHash(vector))
        {
            return CanonicalJsonVectorOperation.IsCalculate(vector)
                ? IsValidCalculation(expected)
                : IsValidVerification(expected);
        }

        return expected.ByteHash is null &&
               expected.SelfHash is null &&
               expected.DeclaredHash is null &&
               expected.VerificationStatus is null &&
               expected.CalculationError is null;
    }

    static bool IsValidCalculation(CanonicalJsonVectorExpected expected) =>
        (expected.SelfHash is null) != (expected.CalculationError is null) &&
        expected.ByteHash is null &&
        (expected.SelfHash is null || Sha256Hash.TryParse(expected.SelfHash, out _)) &&
        (expected.CalculationError is null || string.Equals(expected.CalculationError, "RootNotObject", StringComparison.Ordinal)) &&
        expected.DeclaredHash is null &&
        expected.VerificationStatus is null;

    static bool IsValidVerification(CanonicalJsonVectorExpected expected)
    {
        var status = expected.VerificationStatus;
        var hasDeclaredHash = Sha256Hash.TryParse(expected.DeclaredHash, out _);
        var hasActualHash = Sha256Hash.TryParse(expected.SelfHash, out _);
        return expected.ByteHash is null && status switch
        {
            "Verified" or "Mismatch" => hasDeclaredHash && hasActualHash,
            "Missing" or "Malformed" => expected.DeclaredHash is null && hasActualHash,
            "RootNotObject" => expected.DeclaredHash is null && expected.SelfHash is null,
            _ => false
        } && expected.CalculationError is null;
    }

    static bool HasFlag(CanonicalJsonVector vector, string flag) => vector.Flags!.Contains(flag, StringComparer.Ordinal);

    static bool IsValidCanonicalBytes(CanonicalJsonVector vector, CanonicalJsonVectorExpected expected)
    {
        if (expected.CanonicalBase64 is null)
        {
            return vector.Generator is not null;
        }

        var buffer = new byte[expected.CanonicalBase64.Length];
        return Convert.TryFromBase64String(expected.CanonicalBase64, buffer, out var bytesWritten) &&
               bytesWritten == expected.CanonicalByteLength;
    }
}
