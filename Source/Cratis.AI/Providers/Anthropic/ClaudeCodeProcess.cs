// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Cratis.DependencyInjection;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Owns the lifetime of a completion child. Cancellation never leaves an orphan with a credential.
/// </summary>
[Singleton]
public class ClaudeCodeProcess : IClaudeCodeProcess
{
    /// <inheritdoc/>
    public async Task<ClaudeCodeOutput> Run(ProcessStartInfo startInfo, string prompt, CancellationToken cancellationToken)
    {
        using var process = new Process { StartInfo = startInfo };
        process.Start();
        var output = process.StandardOutput.ReadToEndAsync();
        var errors = process.StandardError.ReadToEndAsync();
        try
        {
            await process.StandardInput.WriteAsync(prompt.AsMemory(), cancellationToken);
            process.StandardInput.Close();
            await process.WaitForExitAsync(cancellationToken);

            return new(process.ExitCode, await output);
        }
        finally
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync(CancellationToken.None);
            await Task.WhenAll(output, errors);
        }
    }
}
