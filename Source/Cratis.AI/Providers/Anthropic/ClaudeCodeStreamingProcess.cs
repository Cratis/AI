// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.Anthropic;

/// <inheritdoc cref="IClaudeCodeStreamingProcess"/>
[Singleton]
public class ClaudeCodeStreamingProcess : IClaudeCodeStreamingProcess
{
    /// <inheritdoc/>
    public async IAsyncEnumerable<string> Run(ProcessStartInfo startInfo, string prompt, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        // Iterator execution starts only on enumeration, so an unused sequence owns no child.
        var process = new Process { StartInfo = startInfo };
        try
        {
            process.Start();
        }
        catch (Win32Exception)
        {
            process.Dispose();
            throw new ClaudeCodeConversationFailed("Claude Code could not start. Verify the packaged subscription-completion runtime.");
        }

        await foreach (var line in Stream(process, prompt, cancellationToken))
        {
            yield return line;
        }
    }

    static async Task DrainErrors(Process process)
    {
        var buffer = new char[4096];
        while (await process.StandardError.ReadAsync(buffer) > 0)
        {
            // Discard diagnostics without retaining an unbounded, potentially secret-bearing string.
        }
    }

    static async IAsyncEnumerable<string> Stream(Process process, string prompt, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        using (process)
        {
            var errors = DrainErrors(process);
            try
            {
                await process.StandardInput.WriteAsync(prompt.AsMemory(), cancellationToken);
                process.StandardInput.Close();

                string? line;
                while ((line = await process.StandardOutput.ReadLineAsync(cancellationToken)) is not null)
                {
                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        yield return line;
                    }
                }

                await process.WaitForExitAsync(cancellationToken);
                if (process.ExitCode != 0)
                {
                    throw new ClaudeCodeConversationFailed("Claude Code exited unsuccessfully.");
                }
            }
            finally
            {
                // Never leaves an orphan holding the credential, cancelled or not: if the loop above
                // exits any other way than the child closing its own stdout, the tree is still killed.
                if (!process.HasExited) process.Kill(entireProcessTree: true);
                await process.WaitForExitAsync(CancellationToken.None);

                // Standard error is drained but never exposed - it may carry diagnostic context
                // unrelated to the conversation, matching the non-streaming transport's own discipline.
                await errors;
            }
        }
    }
}
