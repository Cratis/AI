// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Factory.Canonicalization;

namespace Cratis.Factory.SchemaValidationParity;

sealed record ParitySummary(
    string ProtocolVersion,
    string Tool,
    string Status,
    string? ManifestHash,
    int VectorCount,
    int LoadedCount,
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
            JsonException => "vector-json-invalid",
            FormatException => "vector-base64-invalid",
            InvalidMigrationEnvironment => "python-adapter-failed",
            _ => "local-execution-failed"
        },
        2);

    static ParitySummary Failure(string status, string failureCode, int exitCode) => new(
        "1",
        "temporary-schema-validation-parity",
        status,
        null,
        0,
        0,
        0,
        0,
        0,
        [],
        "temporary-python-jsonschema-oracle",
        failureCode,
        exitCode);
}
