// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.AvailableModels.for_ICanListAvailableModels.given;

public class a_legacy_listing(Func<Task<IEnumerable<ModelName>>> list) : ICanListAvailableModels
{
    public AIProviderType Type => AIProviderType.Anthropic;
    public Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider) => list();
}
