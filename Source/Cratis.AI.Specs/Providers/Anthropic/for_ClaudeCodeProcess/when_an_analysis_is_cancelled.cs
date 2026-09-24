// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Cratis.AI.Agents;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeProcess;

public class when_an_analysis_is_cancelled : Specification
{
    string _directory = null!;
    ProcessStartInfo _info = null!;
    FileSystemWatcher _watcher = null!;
    CancellationTokenSource _cancellation = null!;
    readonly TaskCompletionSource _started = new(TaskCreationOptions.RunContinuationsAsynchronously);
    Exception? _exception;
    int _processId;
    Task<ClaudeCodeOutput>? _running;

    void Establish()
    {
        _directory = Directory.CreateTempSubdirectory().FullName;
        _cancellation = new();
        _watcher = new(_directory, "ready") { EnableRaisingEvents = true };
        _watcher.Created += (_, _) => _started.TrySetResult();
        _info = ClaudeCodeCompletion.StartInfo(_directory, "not-a-real-token", "model", Effort.Low);
        _info.FileName = "/bin/sh";
        _info.ArgumentList.Clear();
        _info.ArgumentList.Add("-c");

        // A deliberately slow test double, not a wait for the assertion: readiness is a filesystem signal.
        _info.ArgumentList.Add($"cat >/dev/null; echo $$ > '{_directory}/pid'; touch '{_directory}/ready'; exec sleep 300");
    }

    async Task Because()
    {
        _running = new ClaudeCodeProcess().Run(_info, "prompt", _cancellation.Token);
        await _started.Task.WaitAsync(TimeSpan.FromSeconds(10));
        _processId = int.Parse(await File.ReadAllTextAsync(Path.Combine(_directory, "pid")), System.Globalization.CultureInfo.InvariantCulture);
        await _cancellation.CancelAsync();
        try { await _running; }
        catch (OperationCanceledException exception) { _exception = exception; }
    }

    [Fact] void should_report_cancellation() => _exception.ShouldNotBeNull();
    [Fact] void should_not_leave_the_child_running() => IsRunning(_processId).ShouldBeFalse();

    static bool IsRunning(int id)
    {
        try
        {
            using var process = Process.GetProcessById(id);
            return !process.HasExited;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    async Task Destroy()
    {
        await _cancellation.CancelAsync();
        if (_running is not null)
        {
            try { await _running; }
            catch (OperationCanceledException) { /* The expected cancellation of this test double. */ }
        }
        _watcher.Dispose();
        _cancellation.Dispose();
        Directory.Delete(_directory, recursive: true);
    }
}
