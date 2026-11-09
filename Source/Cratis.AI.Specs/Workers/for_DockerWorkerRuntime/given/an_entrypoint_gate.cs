// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.given;

public class an_entrypoint_gate : Specification
{
    protected string _file = "/fixture-sensitive-value/credentials";
    protected bool _required = true;
    protected int _exitCode;
    protected string _output;

    protected async Task RunGate()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (!File.Exists(Path.Combine(directory.FullName, "Source/AgentHarnesses/entrypoint.sh")))
        {
            directory = directory.Parent ?? throw new InvalidOperationException("Worker entrypoint source not found.");
        }
        var entrypoint = await File.ReadAllTextAsync(Path.Combine(directory.FullName, "Source/AgentHarnesses/entrypoint.sh"));
        var start = entrypoint.IndexOf("load_secrets() {", StringComparison.Ordinal);
        var end = entrypoint.IndexOf("\n}\n", start, StringComparison.Ordinal) + 3;
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo("bash")
            {
                ArgumentList = { "--noprofile", "--norc" },
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                Environment = { [WorkerSecrets.PathVariableName] = _file, [WorkerSecrets.RequiredVariableName] = _required ? "true" : "false" }
            }
        };
        process.Start();
        await process.StandardInput.WriteLineAsync("sleep() { :; }; log() { printf '%s\\n' \"$*\"; }");
        await process.StandardInput.WriteLineAsync(entrypoint[start..end]);
        await process.StandardInput.WriteLineAsync("load_secrets; printf 'agent-started\\n'");
        process.StandardInput.Close();
        var output = process.StandardOutput.ReadToEndAsync();
        var errors = process.StandardError.ReadToEndAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await process.WaitForExitAsync(deadline.Token);
        _exitCode = process.ExitCode;
        _output = await output + await errors;
    }
}
