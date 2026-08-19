// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Factory.Canonicalization;

namespace Cratis.Factory.CanonicalJsonParity;

sealed record ParitySummary(
    string ProtocolVersion,
    string Tool,
    string Status,
    int VectorCount,
    int AcceptedCount,
    int RejectedCount,
    int MaterialComparisonCount,
    int FailedComparisonCount,
    int[] FailedCaseOrdinals,
    string MigrationBoundary,
    string? FailureCode,
    int ExitCode)
{
    public static ParitySummary InvocationFailure() => Failure("invocation-error", "invalid-arguments", 2);

    public static ParitySummary EnvironmentFailure(Exception error) => Failure(
        "migration-environment-error",
        error switch
        {
            InvalidCanonicalJson => "vector-canonical-json-invalid",
            InvalidVectorManifest invalidVector => invalidVector.Code,
            InvalidParityHarness => "parity-harness-invalid",
            JsonException => "vector-json-invalid",
            FormatException => "vector-base64-invalid",
            InvalidMigrationEnvironment => "python-adapter-failed",
            _ => "local-io-failed"
        },
        2);

    static ParitySummary Failure(string status, string failureCode, int exitCode) => new(
        "1",
        "temporary-canonical-json-parity",
        status,
        0,
        0,
        0,
        0,
        0,
        [],
        "temporary-python-oracle-with-new-v1-bounded-parser-wrapper",
        failureCode,
        exitCode);
}
