// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Runs a Claude Code child and yields its <c>stream-json</c> output line by line as it is produced,
/// killing its process tree on cancellation. The non-streaming sibling, <see cref="IClaudeCodeProcess"/>,
/// buffers the whole output and returns it once the child exits; this one exists for a conversational
/// caller that needs partial text as it streams rather than the final answer.
/// </summary>
public interface IClaudeCodeStreamingProcess
{
    /// <summary>
    /// Starts the child with its prompt on standard input, never in process arguments, and streams its
    /// standard output line by line.
    /// </summary>
    /// <param name="startInfo">The isolated child configuration.</param>
    /// <param name="prompt">The prompt to send through standard input.</param>
    /// <param name="cancellationToken">Cancels the child and its descendants.</param>
    /// <returns>Each non-empty line of standard output, in order.</returns>
    /// <exception cref="ClaudeCodeConversationFailed">The child could not be started.</exception>
    IAsyncEnumerable<string> Run(ProcessStartInfo startInfo, string prompt, CancellationToken cancellationToken);
}
