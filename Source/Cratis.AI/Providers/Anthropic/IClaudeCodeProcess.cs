// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Runs and drains an isolated Claude Code child, killing its process tree on cancellation.
/// </summary>
public interface IClaudeCodeProcess
{
    /// <summary>
    /// Runs the child with its prompt on standard input, never in process arguments.
    /// </summary>
    /// <param name="startInfo">The isolated child configuration.</param>
    /// <param name="prompt">The prompt to send through standard input.</param>
    /// <param name="cancellationToken">Cancels the child and its descendants.</param>
    /// <returns>The child's actual exit code and standard output.</returns>
    Task<ClaudeCodeOutput> Run(ProcessStartInfo startInfo, string prompt, CancellationToken cancellationToken);
}

/// <summary>
/// The child's verdict and result envelope. Standard error is drained but never exposed as it may
/// contain diagnostic context unrelated to the completion.
/// </summary>
/// <param name="ExitCode">The actual child exit code.</param>
/// <param name="StandardOutput">The result envelope.</param>
public record ClaudeCodeOutput(int ExitCode, string StandardOutput);
