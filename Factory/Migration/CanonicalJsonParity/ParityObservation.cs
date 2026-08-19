// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Hashing;

namespace Cratis.Factory.CanonicalJsonParity;

sealed record ParityObservation(
    bool Accepted,
    string? ErrorCode,
    string? CanonicalBase64,
    int? CanonicalByteLength,
    string? CanonicalHash,
    string? ByteHash,
    string? SelfHash,
    string? DeclaredHash,
    string? VerificationStatus,
    string? CalculationError,
    int? Position,
    int? Depth,
    bool RepeatDeterministic)
{
    public static ParityObservation ObserveNative(byte[] input, string operation, string? mode, int repeatCount)
    {
        var first = ObserveNativeOnce(input, operation, mode);
        var repeatDeterministic = true;
        for (var iteration = 1; iteration < repeatCount; iteration++)
        {
            repeatDeterministic &= ObserveNativeOnce(input, operation, mode) == first;
        }

        return first with { RepeatDeterministic = repeatDeterministic };
    }

    public static ParityObservation FromOracle(OracleResponse response) => new(
        response.Accepted,
        response.ErrorCode,
        response.CanonicalBase64,
        response.CanonicalByteLength,
        response.CanonicalHash,
        response.ByteHash,
        response.SelfHash?.Calculated,
        response.SelfHash?.Declared,
        response.SelfHash?.VerificationStatus,
        response.CalculationError,
        response.Position,
        response.Depth,
        response.RepeatDeterministic);

    static ParityObservation ObserveNativeOnce(byte[] input, string operation, string? mode)
    {
        if (!CanonicalJson.TryParse(input, out var value, out var failure))
        {
            return new(
                false,
                failure.Code.ToString(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                failure.Position,
                failure.Depth,
                false);
        }

        string? selfHash = null;
        string? declaredHash = null;
        string? verificationStatus = null;
        string? calculationError = null;
        if (TryGetSelfHashField(operation, out var selfHashField))
        {
            if (string.Equals(mode, "calculate", StringComparison.Ordinal))
            {
                try
                {
                    selfHash = CanonicalJsonSelfHash.Calculate(value, selfHashField).Value;
                }
                catch (CanonicalJsonSelfHashRequiresObject)
                {
                    calculationError = "RootNotObject";
                }
            }
            else
            {
                var verification = CanonicalJsonSelfHash.Verify(value, selfHashField);
                declaredHash = verification.Expected?.Value;
                verificationStatus = verification.Status.ToString();
                if (value.RootElement.ValueKind == JsonValueKind.Object)
                {
                    selfHash = CanonicalJsonSelfHash.Calculate(value, selfHashField).Value;
                }
            }
        }

        return new(
            true,
            null,
            Convert.ToBase64String(value.Utf8),
            value.Utf8.Length,
            CanonicalJsonHash.Calculate(value).Value,
            Sha256Hash.Calculate(input).Value,
            selfHash,
            declaredHash,
            verificationStatus,
            calculationError,
            null,
            null,
            false);
    }

    static bool TryGetSelfHashField(string operation, out CanonicalJsonSelfHashField field)
    {
        field = operation switch
        {
            "contentHash" => CanonicalJsonSelfHashField.ContentHash,
            "requestHash" => CanonicalJsonSelfHashField.RequestHash,
            _ => default
        };
        return string.Equals(operation, "contentHash", StringComparison.Ordinal) ||
               string.Equals(operation, "requestHash", StringComparison.Ordinal);
    }
}
