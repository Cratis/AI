// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// The exception that is thrown when a Claude Code conversational turn did not produce a usable
/// answer - the child could not start, the subscription or model rejected the request, or the stream
/// ended without a result envelope. Never thrown for a tool failure inside the conversation; those are
/// reported back to the model as a tool result instead, see <see cref="ClaudeCodeMcpServer"/>.
/// </summary>
/// <param name="reason">Why the conversation did not complete.</param>
/// <param name="innerException">The underlying cause, when one exists.</param>
/// <param name="kind">Safe failure classification.</param>
/// <param name="functionInvocationAttempted">Whether caller function effects may have occurred, making replay unsafe.</param>
public class ClaudeCodeConversationFailed(string reason, Exception? innerException = null, ClaudeCodeFailureKind kind = ClaudeCodeFailureKind.Conversation, bool functionInvocationAttempted = false) : Exception(reason, innerException)
{
    /// <summary>
    /// Gets the safe failure classification.
    /// </summary>
    public ClaudeCodeFailureKind Kind { get; } = kind;

    /// <summary>
    /// Gets whether any caller function invocation was attempted. A failed attempt can have unknown
    /// effects; this flag prohibits replay even when <see cref="Kind"/> is a rate limit.
    /// </summary>
    public bool FunctionInvocationAttempted { get; internal set; } = functionInvocationAttempted;
}
