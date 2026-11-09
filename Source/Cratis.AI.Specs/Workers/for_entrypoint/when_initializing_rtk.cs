// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_entrypoint;

public class when_initializing_rtk : Specification
{
    string _initialization = string.Empty;

    async Task Because()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (!File.Exists(Path.Combine(directory.FullName, "Source/AgentHarnesses/entrypoint.sh")))
        {
            directory = directory.Parent ?? throw new InvalidOperationException("Worker entrypoint source not found.");
        }
        var entrypoint = await File.ReadAllTextAsync(Path.Combine(directory.FullName, "Source/AgentHarnesses/entrypoint.sh"));
        var start = entrypoint.IndexOf("if command -v timeout", StringComparison.Ordinal);
        var end = entrypoint.IndexOf("\n\n", start, StringComparison.Ordinal);
        _initialization = entrypoint[start..end];
    }

    [Fact] void should_only_use_timeout_when_available() => _initialization.ShouldContain("if command -v timeout >/dev/null 2>&1; then");
    [Fact] void should_bound_initialization_and_force_termination() => _initialization.ShouldContain("timeout -k 2s 10s rtk init -g --auto-patch </dev/null");
    [Fact] void should_keep_older_images_non_interactive() => _initialization.ShouldContain("else\n    rtk init -g --auto-patch </dev/null\nfi");
    [Fact] void should_log_and_continue_after_failure() => _initialization.ShouldContain("fi || log \"rtk init failed - continuing without token optimization\"");
}
