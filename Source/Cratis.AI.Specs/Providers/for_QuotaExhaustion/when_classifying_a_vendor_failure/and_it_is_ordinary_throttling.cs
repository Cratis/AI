// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_QuotaExhaustion.when_classifying_a_vendor_failure;

/// <summary>
/// A per-minute rate limit is throttling, not a spent quota - it keeps the retry after Retry-After.
/// </summary>
public class and_it_is_ordinary_throttling : Specification
{
    bool _result;

    void Because() => _result = QuotaExhaustion.IsIndicatedBy(429, null, """{"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}""");

    [Fact] void should_not_be_quota_exhausted() => _result.ShouldBeFalse();
}
