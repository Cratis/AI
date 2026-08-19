// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.ComponentModel;
using System.Text.Json;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Hashing;

namespace Cratis.Factory.CanonicalJsonParity;

static class ParityRunner
{
    public static ParitySummary Run(ParityConfiguration configuration)
    {
        try
        {
            return RunCore(configuration);
        }
        catch (Exception error) when (error is
            IOException or
            UnauthorizedAccessException or
            JsonException or
            FormatException or
            Win32Exception or
            InvalidCanonicalJson or
            InvalidParityHarness or
            InvalidVectorManifest or
            InvalidMigrationEnvironment)
        {
            return ParitySummary.EnvironmentFailure(error);
        }
    }

    static ParitySummary RunCore(ParityConfiguration configuration)
    {
        var vectorPath = Path.Combine(
            configuration.RepositoryRoot,
            "Factory",
            "Fixtures",
            "Contracts",
            "v1",
            "canonical-json-vectors.json");
        var manifestBytes = File.ReadAllBytes(vectorPath);
        var manifestValue = CanonicalJson.Parse(manifestBytes);
        var manifestHash = CanonicalJsonSelfHash.Verify(manifestValue, CanonicalJsonSelfHashField.ContentHash);
        if (manifestHash.Status != CanonicalJsonSelfHashVerificationStatus.Verified)
        {
            throw new InvalidVectorManifest("manifest-content-hash-invalid");
        }

        var manifest = JsonSerializer.Deserialize<VectorManifest>(
            manifestBytes,
            ParityJson.Options) ?? throw new InvalidVectorManifest();
        var vectors = Validate(manifest);
        ValidateComparisonWiring();

        var comparisons = new ComparisonTracker();
        var acceptedCount = 0;
        using var oracle = new PythonOracle(configuration.PythonExecutable, configuration.RepositoryRoot);
        for (var ordinal = 0; ordinal < vectors.Length; ordinal++)
        {
            var vector = vectors[ordinal];
            byte[] input;
            try
            {
                input = VectorInputGenerator.Generate(vector);
            }
            catch (InvalidVectorManifest)
            {
                throw new InvalidVectorManifest($"generator-invalid-at-{ordinal}");
            }
            var repeatCount = vector.RepeatCount!.Value;
            var expected = vector.Expected!;
            var native = ParityObservation.ObserveNative(input, vector.Operation!, vector.Mode, repeatCount);
            var python = ParityObservation.FromOracle(oracle.Evaluate(input, vector.Operation!, vector.Mode, repeatCount));
            CompareImplementations(native, python, ordinal, comparisons);
            CompareExpected(expected, native, vector.Mode, ordinal, comparisons);
            CompareExpected(expected, python, vector.Mode, ordinal, comparisons);
            comparisons.Check(true, native.RepeatDeterministic, ordinal);
            comparisons.Check(true, python.RepeatDeterministic, ordinal);
            if (expected.Accepted!.Value)
            {
                acceptedCount++;
            }
        }

        return new(
            manifest.ProtocolVersion!,
            "temporary-canonical-json-parity",
            comparisons.FailedCount == 0 ? "success" : "parity-failed",
            vectors.Length,
            acceptedCount,
            vectors.Length - acceptedCount,
            comparisons.Count,
            comparisons.FailedCount,
            [.. comparisons.FailedCaseOrdinals],
            "temporary-python-oracle-with-new-v1-bounded-parser-wrapper",
            null,
            comparisons.FailedCount == 0 ? 0 : 1);
    }

    static void CompareImplementations(
        ParityObservation native,
        ParityObservation python,
        int ordinal,
        ComparisonTracker comparisons)
    {
        comparisons.Check(native.Accepted, python.Accepted, ordinal);
        comparisons.Check(native.ErrorCode, python.ErrorCode, ordinal);
        comparisons.Check(native.CanonicalBase64, python.CanonicalBase64, ordinal);
        comparisons.Check(native.CanonicalByteLength, python.CanonicalByteLength, ordinal);
        comparisons.Check(native.CanonicalHash, python.CanonicalHash, ordinal);
        comparisons.Check(native.ByteHash, python.ByteHash, ordinal);
        comparisons.Check(native.SelfHash, python.SelfHash, ordinal);
        comparisons.Check(native.DeclaredHash, python.DeclaredHash, ordinal);
        comparisons.Check(native.VerificationStatus, python.VerificationStatus, ordinal);
        comparisons.Check(native.CalculationError, python.CalculationError, ordinal);
        comparisons.Check(native.Position, python.Position, ordinal);
        comparisons.Check(native.Depth, python.Depth, ordinal);
        comparisons.Check(native.RepeatDeterministic, python.RepeatDeterministic, ordinal);
    }

    static void CompareExpected(
        VectorExpectation expected,
        ParityObservation actual,
        string? mode,
        int ordinal,
        ComparisonTracker comparisons)
    {
        comparisons.Check(expected.Accepted!.Value, actual.Accepted, ordinal);
        if (!expected.Accepted.Value)
        {
            comparisons.Check(expected.ErrorCode, actual.ErrorCode, ordinal);
            CheckWhenPresent(expected.Position, actual.Position, ordinal, comparisons);
            CheckWhenPresent(expected.Depth, actual.Depth, ordinal, comparisons);
            return;
        }

        CheckWhenPresent(expected.CanonicalBase64, actual.CanonicalBase64, ordinal, comparisons);
        CheckWhenPresent(expected.CanonicalByteLength, actual.CanonicalByteLength, ordinal, comparisons);
        CheckWhenPresent(expected.CanonicalHash, actual.CanonicalHash, ordinal, comparisons);
        CheckWhenPresent(expected.ByteHash, actual.ByteHash, ordinal, comparisons);
        CheckWhenPresent(expected.SelfHash, actual.SelfHash, ordinal, comparisons);
        if (string.Equals(mode, "verify", StringComparison.Ordinal))
        {
            comparisons.Check(expected.DeclaredHash, actual.DeclaredHash, ordinal);
        }
        CheckWhenPresent(expected.VerificationStatus, actual.VerificationStatus, ordinal, comparisons);
        CheckWhenPresent(expected.CalculationError, actual.CalculationError, ordinal, comparisons);
        CheckWhenPresent(expected.Position, actual.Position, ordinal, comparisons);
        CheckWhenPresent(expected.Depth, actual.Depth, ordinal, comparisons);
    }

    static void CheckWhenPresent<T>(T? expected, T? actual, int ordinal, ComparisonTracker comparisons)
    {
        if (expected is not null)
        {
            comparisons.Check(expected, actual, ordinal);
        }
    }

    static VectorCase[] Validate(VectorManifest manifest)
    {
        var limits = manifest.Limits;
        var cases = manifest.Cases;
        if (manifest.ProtocolVersion != "1" ||
            manifest.Algorithm != "factory-canonical-json-v1" ||
            string.IsNullOrWhiteSpace(manifest.Description) ||
            !IsValid(manifest.GeneratorContract) ||
            limits is null ||
            limits.MaximumInputBytes != CanonicalJsonLimits.MaximumInputBytes ||
            limits.MaximumOutputBytes != CanonicalJsonLimits.MaximumCanonicalBytes ||
            limits.MaximumDepth != CanonicalJsonLimits.MaximumNestingDepth ||
            limits.MaximumStringScalars != CanonicalJsonLimits.MaximumStringScalars ||
            limits.MaximumKeyScalars != CanonicalJsonLimits.MaximumStringScalars ||
            limits.MaximumStructuralPunctuationTokens != CanonicalJsonLimits.MaximumStructuralTokens ||
            limits.MaximumArrayItems != CanonicalJsonLimits.MaximumArrayItems ||
            limits.MaximumObjectMembers != CanonicalJsonLimits.MaximumObjectMembers ||
            cases is null ||
            cases.Length == 0)
        {
            throw new InvalidVectorManifest("manifest-header-invalid");
        }

        var validatedCases = new VectorCase[cases.Length];
        for (var index = 0; index < cases.Length; index++)
        {
            var vector = cases[index] ?? throw new InvalidVectorManifest("manifest-case-invalid");
            var isCanonicalOperation = string.Equals(vector.Operation, "canonicalize", StringComparison.Ordinal) ||
                                       string.Equals(vector.Operation, "byteHash", StringComparison.Ordinal);
            var isSelfHashOperation = string.Equals(vector.Operation, "contentHash", StringComparison.Ordinal) ||
                                      string.Equals(vector.Operation, "requestHash", StringComparison.Ordinal);
            var operationAndModeAreKnown = (isCanonicalOperation && vector.Mode is null) ||
                                           (isSelfHashOperation &&
                                            (string.Equals(vector.Mode, "calculate", StringComparison.Ordinal) ||
                                             string.Equals(vector.Mode, "verify", StringComparison.Ordinal)));
            if (string.IsNullOrWhiteSpace(vector.Id) ||
                vector.RepeatCount is null or < 2 or > 100 ||
                !operationAndModeAreKnown ||
                vector.Expected is null ||
                !VectorInputGenerator.IsValid(vector) ||
                vector.Flags is not { Length: > 0 } ||
                vector.Flags.Any(string.IsNullOrWhiteSpace) ||
                vector.AllocationCeilingBytes is <= 0 ||
                IsInvalidOptional(vector.DistinctFromGroup) ||
                IsInvalidOptional(vector.EquivalenceGroup) ||
                IsInvalidOptional(vector.ProjectionHint) ||
                IsInvalidOptional(vector.SourceHint) ||
                vector.ForbiddenErrorSubstrings is { Length: 0 } ||
                vector.ForbiddenErrorSubstrings?.Any(string.IsNullOrWhiteSpace) == true ||
                !IsValid(vector.Expected, vector.Operation!, vector.Mode))
            {
                throw new InvalidVectorManifest("manifest-case-invalid");
            }
            validatedCases[index] = vector;
        }

        return validatedCases;
    }

    static bool IsValid(VectorGeneratorContract? contract) => contract is not null &&
        new[]
        {
            contract.RepeatedString,
            contract.SinglePropertyObject,
            contract.ArrayOfNulls,
            contract.ObjectWithNullMembers,
            contract.NestedArrays,
            contract.PaddedValue,
            contract.TwoStringObject,
            contract.SelfHashObject,
            contract.ObjectWithOneEmptyObjectMember,
            contract.ArrayWithOneEmptyArrayItem
        }.All(value => !string.IsNullOrWhiteSpace(value));

    static bool IsValid(VectorExpectation expected, string operation, string? mode)
    {
        if (!expected.Accepted.HasValue)
        {
            return false;
        }

        if (!expected.Accepted.Value)
        {
            return expected.CanonicalBase64 is null &&
                   expected.CanonicalByteLength is null &&
                   expected.CanonicalHash is null &&
                   expected.ByteHash is null &&
                   expected.SelfHash is null &&
                   expected.DeclaredHash is null &&
                   expected.VerificationStatus is null &&
                   expected.CalculationError is null &&
                   IsFailureCode(expected.ErrorCode) &&
                   expected.Position is null or >= 0 &&
                   expected.Depth is null or >= 0;
        }

        if (expected.ErrorCode is not null ||
            expected.Position is not null ||
            expected.Depth is not null ||
            expected.CanonicalByteLength is null or < 0 ||
            !IsHash(expected.CanonicalHash) ||
            !CanonicalBytesMatchLength(expected.CanonicalBase64, expected.CanonicalByteLength.Value))
        {
            return false;
        }

        if (string.Equals(operation, "byteHash", StringComparison.Ordinal))
        {
            return IsHash(expected.ByteHash) &&
                   expected.SelfHash is null &&
                   expected.DeclaredHash is null &&
                   expected.VerificationStatus is null &&
                   expected.CalculationError is null;
        }

        if (string.Equals(operation, "canonicalize", StringComparison.Ordinal))
        {
            return expected.ByteHash is null &&
                   expected.SelfHash is null &&
                   expected.DeclaredHash is null &&
                   expected.VerificationStatus is null &&
                   expected.CalculationError is null;
        }

        if (string.Equals(mode, "calculate", StringComparison.Ordinal))
        {
            var hasCalculatedHash = IsHash(expected.SelfHash) && expected.CalculationError is null;
            var hasCalculationError = expected.SelfHash is null &&
                                      string.Equals(expected.CalculationError, "RootNotObject", StringComparison.Ordinal);
            return expected.ByteHash is null &&
                   expected.DeclaredHash is null &&
                   expected.VerificationStatus is null &&
                   (hasCalculatedHash || hasCalculationError);
        }

        var hasActualHash = IsHash(expected.SelfHash);
        var statusIsRootNotObject = string.Equals(expected.VerificationStatus, "RootNotObject", StringComparison.Ordinal);
        var statusHasDeclaredHash = string.Equals(expected.VerificationStatus, "Verified", StringComparison.Ordinal) ||
                                    string.Equals(expected.VerificationStatus, "Mismatch", StringComparison.Ordinal);
        var statusHasNoDeclaredHash = string.Equals(expected.VerificationStatus, "Missing", StringComparison.Ordinal) ||
                                     string.Equals(expected.VerificationStatus, "Malformed", StringComparison.Ordinal) ||
                                     statusIsRootNotObject;
        return expected.ByteHash is null &&
               expected.CalculationError is null &&
               (hasActualHash != statusIsRootNotObject) &&
               ((statusHasDeclaredHash && IsHash(expected.DeclaredHash)) ||
                (statusHasNoDeclaredHash && expected.DeclaredHash is null));
    }

    static bool IsFailureCode(string? code) => Enum.TryParse<CanonicalJsonFailureCode>(code, false, out var parsed) &&
                                                Enum.IsDefined(parsed);

    static bool IsHash(string? value) => Sha256Hash.TryParse(value, out _);

    static bool CanonicalBytesMatchLength(string? canonicalBase64, int expectedLength)
    {
        if (canonicalBase64 is null)
        {
            return true;
        }

        try
        {
            return Convert.FromBase64String(canonicalBase64).Length == expectedLength;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    static bool IsInvalidOptional(string? value) => value is not null && string.IsNullOrWhiteSpace(value);

    static void ValidateComparisonWiring()
    {
        const string declaredHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
        var rejectedActual = new ParityObservation(
            Accepted: false,
            ErrorCode: "MalformedJson",
            CanonicalBase64: null,
            CanonicalByteLength: null,
            CanonicalHash: null,
            ByteHash: null,
            SelfHash: null,
            DeclaredHash: null,
            VerificationStatus: null,
            CalculationError: null,
            Position: 1,
            Depth: 1,
            RepeatDeterministic: true);
        var differentMetadata = rejectedActual with { Position = 2, Depth = 2 };
        var implementationComparisons = new ComparisonTracker();
        CompareImplementations(rejectedActual, differentMetadata, 0, implementationComparisons);

        var rejectedExpected = new VectorExpectation(
            Accepted: false,
            CanonicalBase64: null,
            CanonicalByteLength: null,
            CanonicalHash: null,
            ByteHash: null,
            SelfHash: null,
            DeclaredHash: null,
            VerificationStatus: null,
            CalculationError: null,
            ErrorCode: "MalformedJson",
            Position: 2,
            Depth: 2);
        var expectedComparisons = new ComparisonTracker();
        CompareExpected(rejectedExpected, rejectedActual, null, 0, expectedComparisons);

        var verificationWithoutDeclared = rejectedActual with
        {
            Accepted = true,
            ErrorCode = null,
            Position = null,
            Depth = null
        };
        var verificationWithDeclared = verificationWithoutDeclared with { DeclaredHash = declaredHash };
        var declaredImplementationComparisons = new ComparisonTracker();
        CompareImplementations(verificationWithoutDeclared, verificationWithDeclared, 0, declaredImplementationComparisons);

        var expectedWithoutDeclared = rejectedExpected with
        {
            Accepted = true,
            ErrorCode = null,
            Position = null,
            Depth = null
        };
        var absentDeclaredComparisons = new ComparisonTracker();
        CompareExpected(expectedWithoutDeclared, verificationWithDeclared, "verify", 0, absentDeclaredComparisons);
        var expectedWithDeclared = expectedWithoutDeclared with { DeclaredHash = declaredHash };
        var presentDeclaredComparisons = new ComparisonTracker();
        CompareExpected(expectedWithDeclared, verificationWithoutDeclared, "verify", 0, presentDeclaredComparisons);

        if (implementationComparisons.FailedCount != 2 ||
            expectedComparisons.FailedCount != 2 ||
            declaredImplementationComparisons.FailedCount != 1 ||
            absentDeclaredComparisons.FailedCount != 1 ||
            presentDeclaredComparisons.FailedCount != 1)
        {
            throw new InvalidParityHarness();
        }
    }
}

sealed class InvalidParityHarness : Exception;
