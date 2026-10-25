// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_QuotaExhaustion.when_classifying_a_vendor_failure;

/// <summary>
/// Anthropic answers an enforced organization spend limit with a 429 whose code names it.
/// </summary>
public class and_it_carries_an_anthropic_spend_limit_code : Specification
{
    bool _result;

    void Because() => _result = QuotaExhaustion.IsIndicatedBy(429, "enforced_spend_limit_reached", """{"error":{"type":"rate_limit_error","details":{"error_code":"enforced_spend_limit_reached"}}}""");

    [Fact] void should_be_quota_exhausted() => _result.ShouldBeTrue();
}
