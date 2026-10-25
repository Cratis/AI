// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations;

/// <summary>
/// Represents an implementation of <see cref="IProviderChatClientFactory"/> on top of <see cref="AIChatClientFactory"/>.
/// </summary>
public class ProviderChatClientFactory : IProviderChatClientFactory
{
    /// <inheritdoc/>
    public bool CanServe(ConfiguredAIProvider provider, ModelName model) =>
        AIChatClientFactory.CanServe(provider.Type, provider.ApiKey, provider.Endpoint, model);

    /// <inheritdoc/>
    public Task<IChatClient?> Create(ConfiguredAIProvider provider, ModelName model) =>
        Task.FromResult(AIChatClientFactory.Create(provider.Type, provider.ApiKey, provider.Endpoint, model.Value)?.Client);
}
