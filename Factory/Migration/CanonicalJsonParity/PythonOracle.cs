// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Text.Json;

namespace Cratis.Factory.CanonicalJsonParity;

sealed class PythonOracle : IDisposable
{
    readonly Process _process;

    public PythonOracle(string pythonExecutable, string repositoryRoot)
    {
        var adapter = Path.Combine(repositoryRoot, "Factory", "Migration", "CanonicalJsonParity", "oracle_adapter.py");
        var oracle = Path.Combine(repositoryRoot, "Factory", "scripts", "canonical_json.py");
        if (!File.Exists(adapter) || !File.Exists(oracle))
        {
            throw new InvalidMigrationEnvironment();
        }

        var start = new ProcessStartInfo
        {
            FileName = pythonExecutable,
            WorkingDirectory = repositoryRoot,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        start.ArgumentList.Add("-I");
        start.ArgumentList.Add("-B");
        start.ArgumentList.Add(adapter);
        start.ArgumentList.Add("--oracle");
        start.ArgumentList.Add(oracle);
        _process = new() { StartInfo = start };
        _process.ErrorDataReceived += (_, _) => { };
        if (!_process.Start())
        {
            throw new InvalidMigrationEnvironment();
        }
        _process.BeginErrorReadLine();
    }

    public OracleResponse Evaluate(byte[] input, string operation, string? mode, int repeatCount)
    {
        var selfHashField = operation switch
        {
            "contentHash" => "contentHash",
            "requestHash" => "requestHash",
            _ => null
        };
        var request = new OracleRequest(Convert.ToBase64String(input), repeatCount, selfHashField, mode);
        _process.StandardInput.WriteLine(JsonSerializer.Serialize(request, ParityJson.Options));
        var response = _process.StandardOutput.ReadLine();
        return response is null
            ? throw new InvalidMigrationEnvironment()
            : JsonSerializer.Deserialize<OracleResponse>(response, ParityJson.Options) ?? throw new InvalidMigrationEnvironment();
    }

    public void Dispose()
    {
        try
        {
            _process.StandardInput.Close();
            if (!_process.WaitForExit(TimeSpan.FromSeconds(10)))
            {
                _process.Kill(true);
                _process.WaitForExit();
                throw new InvalidMigrationEnvironment();
            }
            if (_process.ExitCode != 0)
            {
                throw new InvalidMigrationEnvironment();
            }
        }
        finally
        {
            _process.Dispose();
        }
    }
}

sealed record OracleRequest(string InputBase64, int RepeatCount, string? SelfHashField, string? Mode);

sealed record OracleResponse(
    bool Accepted,
    string? ErrorCode,
    string? CanonicalBase64,
    int? CanonicalByteLength,
    string? CanonicalHash,
    string? ByteHash,
    OracleSelfHash? SelfHash,
    string? CalculationError,
    int? Position,
    int? Depth,
    bool RepeatDeterministic);

sealed record OracleSelfHash(string? Calculated, string? Declared, string? VerificationStatus);

sealed class InvalidMigrationEnvironment : Exception;
