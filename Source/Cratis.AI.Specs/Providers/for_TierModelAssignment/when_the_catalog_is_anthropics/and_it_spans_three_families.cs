// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers.for_TierModelAssignment.when_the_catalog_is_anthropics;

/// <summary>
/// The catalog Anthropic actually returns, newest first and several generations deep. Every tier
/// must land on the newest model of its family - which is the whole point of deriving the mapping
/// from the catalog rather than carrying model names around (#1187).
/// </summary>
public class and_it_spans_three_families : Specification
{
    TierModels _result;

    void Because() => _result = TierModelAssignment.From(
    [
        new ModelName("claude-opus-4-5-20251101"),
        new ModelName("claude-haiku-4-5-20251001"),
        new ModelName("claude-sonnet-4-5-20250929"),
        new ModelName("claude-opus-4-1-20250805"),
        new ModelName("claude-3-5-sonnet-20241022"),
        new ModelName("claude-3-haiku-20240307"),
    ]);

    [Fact] void should_put_the_newest_haiku_on_fast() => _result.Fast.ShouldEqual(new ModelName("claude-haiku-4-5-20251001"));

    [Fact] void should_put_the_newest_sonnet_on_balanced() => _result.Balanced.ShouldEqual(new ModelName("claude-sonnet-4-5-20250929"));

    [Fact] void should_put_the_newest_opus_on_powerful() => _result.Powerful.ShouldEqual(new ModelName("claude-opus-4-5-20251101"));

    // No family above the flagship in this catalog, so the flagship takes the top tier too - better
    // than Premier resolving to nothing on the many vendors that publish nothing above theirs.
    [Fact] void should_fall_back_to_the_newest_opus_on_premier() => _result.Premier.ShouldEqual(new ModelName("claude-opus-4-5-20251101"));
}
