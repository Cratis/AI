// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelAssignment.when_the_catalog_carries_models_that_cannot_converse;

/// <summary>
/// OpenAI's catalog is mostly not chat models - embeddings, speech, moderation and image models all
/// come back from the same endpoint. A tier resolving to one of those dispatches a worker session to
/// a model that cannot hold a conversation, so they are excluded before anything is ranked.
/// </summary>
public class and_embeddings_are_listed_alongside : Specification
{
    TierModels _result;

    void Because() => _result = TierModelAssignment.From(
    [
        new ModelName("text-embedding-3-large"),
        new ModelName("whisper-1"),
        new ModelName("dall-e-3"),
        new ModelName("omni-moderation-latest"),
        new ModelName("gpt-5.3"),
        new ModelName("gpt-5.3-nano"),
    ]);

    [Fact] void should_put_the_small_chat_model_on_fast() => _result.Fast.ShouldEqual(new ModelName("gpt-5.3-nano"));

    [Fact] void should_put_the_chat_model_on_balanced() => _result.Balanced.ShouldEqual(new ModelName("gpt-5.3"));

    [Fact] void should_never_reach_for_a_non_chat_model() => _result.Premier.ShouldEqual(new ModelName("gpt-5.3"));
}
