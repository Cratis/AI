// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>The safe default until a consumer supplies its administrative policy.</summary>
public class DenyProviderSelectionAuthority : IProviderSelectionAuthority
{
    /// <inheritdoc/>
    public Task<bool> CanSet(AIProviderId provider) => Task.FromResult(false);
}
