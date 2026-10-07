// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations;

/// <summary>
/// Defines a system that opens a vendor <see cref="IChatClient"/> for a configured provider.
/// </summary>
public interface IProviderChatClientFactory
{
    /// <summary>
    /// Determines whether the provider carries everything its vendor needs to serve a model.
    /// </summary>
    /// <param name="provider">The configured provider.</param>
    /// <param name="model">The model to serve.</param>
    /// <returns><see langword="true"/> when a client can be opened.</returns>
    bool CanServe(ConfiguredAIProvider provider, ModelName model);

    /// <summary>
    /// Opens a client for the provider and model. The caller disposes it.
    /// </summary>
    /// <param name="provider">The configured provider.</param>
    /// <param name="model">The model to talk to.</param>
    /// <returns>The client, or <see langword="null"/> when the vendor has no conversational client.</returns>
    IChatClient? Create(ConfiguredAIProvider provider, ModelName model);
}
