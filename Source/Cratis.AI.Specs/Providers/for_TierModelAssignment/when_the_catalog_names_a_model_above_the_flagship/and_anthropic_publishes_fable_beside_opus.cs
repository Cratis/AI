// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelAssignment.when_the_catalog_names_a_model_above_the_flagship;

/// <summary>
/// The catalog an Anthropic organization key actually returns today, newest first. It names four
/// families, and Direct has four tiers, so every tier must land on a different one: a ladder with
/// only three rungs put the frontier model on Balanced - because it recognized neither the family
/// nor the word, and everything unrecognized is the everyday middle - and then handed Powerful and
/// Premier the same flagship, which makes Direct's top tier mean nothing at all.
/// </summary>
public class and_anthropic_publishes_fable_beside_opus : Specification
{
    TierModels _result;

    void Because() => _result = TierModelAssignment.From(
    [
        new ModelName("claude-fable-5-1"),
        new ModelName("claude-opus-5"),
        new ModelName("claude-sonnet-5"),
        new ModelName("claude-fable-5"),
        new ModelName("claude-opus-4-8"),
        new ModelName("claude-sonnet-4-6"),
        new ModelName("claude-opus-4-5-20251101"),
        new ModelName("claude-haiku-4-5-20251001"),
    ]);

    [Fact] void should_put_haiku_on_fast() => _result.Fast.ShouldEqual(new ModelName("claude-haiku-4-5-20251001"));

    [Fact] void should_put_the_newest_sonnet_on_balanced() => _result.Balanced.ShouldEqual(new ModelName("claude-sonnet-5"));

    [Fact] void should_put_the_newest_opus_on_powerful() => _result.Powerful.ShouldEqual(new ModelName("claude-opus-5"));

    [Fact] void should_put_the_newest_fable_on_premier() => _result.Premier.ShouldEqual(new ModelName("claude-fable-5-1"));
}
