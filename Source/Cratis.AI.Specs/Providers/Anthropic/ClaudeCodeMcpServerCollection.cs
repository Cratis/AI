// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Groups every spec that binds a real loopback <see cref="System.Net.HttpListener"/> (through
/// <see cref="ClaudeCodeMcpServer"/>, directly or via <see cref="ClaudeCodeChatClient"/>) into one
/// xUnit collection so they run sequentially relative to each other. xUnit otherwise runs spec classes
/// in parallel by default, and .NET's own <see cref="System.Net.HttpListener"/> implementation shares
/// process-wide state across independent instances - observed directly as flaky
/// <c>HttpListenerException: Address already in use</c> failures when two of these specs started or
/// stopped a listener at the same moment, even on two different ports.
/// </summary>
[CollectionDefinition(Name)]
public static class ClaudeCodeMcpServerCollection
{
    /// <summary>
    /// The collection name every spec in this group passes to <see cref="CollectionAttribute"/>.
    /// </summary>
    public const string Name = "Claude Code MCP loopback server";
}
