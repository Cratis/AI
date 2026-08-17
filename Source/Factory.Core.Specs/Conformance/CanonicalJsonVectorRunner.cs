// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Conformance;

static class CanonicalJsonVectorRunner
{
    public static IReadOnlyList<string> Execute(CanonicalJsonVectorManifest manifest)
    {
        var failures = new List<string>();
        foreach (var vector in manifest.Cases)
        {
            var input = CanonicalJsonVectorInput.Create(vector);
            string? firstFingerprint = null;
            for (var iteration = 0; iteration < vector.RepeatCount; iteration++)
            {
                var fingerprint = ExecuteOnce(vector, input, failures);
                firstFingerprint ??= fingerprint;
                if (!string.Equals(firstFingerprint, fingerprint, StringComparison.Ordinal))
                {
                    failures.Add($"{vector.Id}: iteration {iteration + 1} was not deterministic.");
                }
            }
        }

        return failures;
    }

    static string ExecuteOnce(CanonicalJsonVector vector, byte[] input, List<string> failures)
    {
        try
        {
            var accepted = CanonicalJson.TryParse(input, out var value, out var failure);
            if (!vector.Expected.Accepted)
            {
                return VerifyRejection(vector, input, accepted, failure, failures);
            }

            if (!accepted)
            {
                failures.Add($"{vector.Id}: rejected with {failure!.Code}; expected acceptance.");
                return $"rejected:{failure.Code}";
            }

            VerifyCanonicalValue(vector, input, value!, failures);
            return CreateAcceptedFingerprint(vector, input, value!);
        }
        catch (Exception error)
        {
            failures.Add($"{vector.Id}: unexpected {error.GetType().Name}.");
            return $"exception:{error.GetType().Name}";
        }
    }

    static string VerifyRejection(
        CanonicalJsonVector vector,
        byte[] input,
        bool accepted,
        CanonicalJsonFailure? failure,
        List<string> failures)
    {
        if (accepted)
        {
            failures.Add($"{vector.Id}: accepted; expected {vector.Expected.ErrorCode} rejection.");
            return "accepted";
        }

        var actualCode = failure!.Code.ToString();
        if (!string.Equals(actualCode, vector.Expected.ErrorCode, StringComparison.Ordinal))
        {
            failures.Add($"{vector.Id}: rejected with {actualCode}; expected {vector.Expected.ErrorCode}.");
        }

        if (vector.Expected.Position.HasValue && failure.Position != vector.Expected.Position)
        {
            failures.Add($"{vector.Id}: rejection position {failure.Position}; expected {vector.Expected.Position}.");
        }

        if (vector.Expected.Depth.HasValue && failure.Depth != vector.Expected.Depth)
        {
            failures.Add($"{vector.Id}: rejection depth {failure.Depth}; expected {vector.Expected.Depth}.");
        }

        CanonicalJsonFailureProjectionVerifier.Verify(vector, input, failures);
        return $"rejected:{actualCode}:{failure.Position}:{failure.Depth}";
    }

    static void VerifyCanonicalValue(
        CanonicalJsonVector vector,
        byte[] input,
        CanonicalJsonValue value,
        List<string> failures)
    {
        var canonical = value.ToArray();
        if (canonical.Length != vector.Expected.CanonicalByteLength)
        {
            failures.Add($"{vector.Id}: canonical length {canonical.Length}; expected {vector.Expected.CanonicalByteLength}.");
        }

        if (vector.Expected.CanonicalBase64 is not null &&
            !canonical.AsSpan().SequenceEqual(Convert.FromBase64String(vector.Expected.CanonicalBase64)))
        {
            failures.Add($"{vector.Id}: canonical bytes differ.");
        }

        var canonicalHash = CanonicalJsonHash.Calculate(value).Value;
        if (!string.Equals(canonicalHash, vector.Expected.CanonicalHash, StringComparison.Ordinal))
        {
            failures.Add($"{vector.Id}: canonical hash {canonicalHash}; expected {vector.Expected.CanonicalHash}.");
        }

        if (vector.Expected.ByteHash is not null)
        {
            var byteHash = Sha256Hash.Calculate(input).Value;
            if (!string.Equals(byteHash, vector.Expected.ByteHash, StringComparison.Ordinal))
            {
                failures.Add($"{vector.Id}: byte hash {byteHash}; expected {vector.Expected.ByteHash}.");
            }
        }

        var destination = new ArrayBufferWriter<byte>();
        value.WriteTo(destination);
        if (!destination.WrittenSpan.SequenceEqual(canonical))
        {
            failures.Add($"{vector.Id}: caller-owned buffer output differs.");
        }

        VerifyDefensiveCopy(vector, value, canonical, failures);
        VerifySelfHash(vector, value, failures);
    }

    static void VerifyDefensiveCopy(
        CanonicalJsonVector vector,
        CanonicalJsonValue value,
        byte[] canonical,
        List<string> failures)
    {
        if (canonical.Length == 0)
        {
            return;
        }

        canonical[0] ^= 0xff;
        if (value.Utf8[0] == canonical[0])
        {
            failures.Add($"{vector.Id}: ToArray returned mutable internal storage.");
        }
    }

    static void VerifySelfHash(CanonicalJsonVector vector, CanonicalJsonValue value, List<string> failures)
    {
        if (!CanonicalJsonVectorOperation.IsSelfHash(vector))
        {
            return;
        }

        var field = CanonicalJsonVectorOperation.GetSelfHashField(vector);
        if (CanonicalJsonVectorOperation.IsCalculate(vector))
        {
            if (vector.Expected.CalculationError is not null)
            {
                var error = Cratis.Specifications.Catch.Exception(() => CanonicalJsonSelfHash.Calculate(value, field));
                if (error is not CanonicalJsonSelfHashRequiresObject ||
                    !string.Equals(vector.Expected.CalculationError, "RootNotObject", StringComparison.Ordinal))
                {
                    failures.Add($"{vector.Id}: calculation error {error?.GetType().Name ?? "none"}; expected {vector.Expected.CalculationError}.");
                }

                return;
            }

            var actual = CanonicalJsonSelfHash.Calculate(value, field).Value;
            if (!string.Equals(actual, vector.Expected.SelfHash, StringComparison.Ordinal))
            {
                failures.Add($"{vector.Id}: self hash {actual}; expected {vector.Expected.SelfHash}.");
            }

            return;
        }

        var verification = CanonicalJsonSelfHash.Verify(value, field);
        if (!string.Equals(verification.Status.ToString(), vector.Expected.VerificationStatus, StringComparison.Ordinal))
        {
            failures.Add($"{vector.Id}: verification status {verification.Status}; expected {vector.Expected.VerificationStatus}.");
        }

        if (!string.Equals(verification.Expected?.Value, vector.Expected.DeclaredHash, StringComparison.Ordinal))
        {
            failures.Add($"{vector.Id}: declared self hash {verification.Expected?.Value}; expected {vector.Expected.DeclaredHash}.");
        }

        if (!string.Equals(verification.Actual?.Value, vector.Expected.SelfHash, StringComparison.Ordinal))
        {
            failures.Add($"{vector.Id}: calculated self hash {verification.Actual?.Value}; expected {vector.Expected.SelfHash}.");
        }
    }

    static string CreateAcceptedFingerprint(CanonicalJsonVector vector, byte[] input, CanonicalJsonValue value)
    {
        var fingerprint = $"accepted:{CanonicalJsonHash.Calculate(value).Value}";
        if (vector.Expected.ByteHash is not null)
        {
            fingerprint += $":{Sha256Hash.Calculate(input).Value}";
        }

        if (CanonicalJsonVectorOperation.IsSelfHash(vector))
        {
            var field = CanonicalJsonVectorOperation.GetSelfHashField(vector);
            if (CanonicalJsonVectorOperation.IsCalculate(vector))
            {
                try
                {
                    fingerprint += $":{CanonicalJsonSelfHash.Calculate(value, field).Value}";
                }
                catch (CanonicalJsonSelfHashRequiresObject)
                {
                    fingerprint += ":RootNotObject";
                }
            }
            else
            {
                fingerprint += $":{CanonicalJsonSelfHash.Verify(value, field).Status}";
            }
        }

        return fingerprint;
    }
}
