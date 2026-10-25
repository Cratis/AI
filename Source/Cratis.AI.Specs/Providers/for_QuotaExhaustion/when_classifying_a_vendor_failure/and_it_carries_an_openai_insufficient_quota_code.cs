// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_QuotaExhaustion.when_classifying_a_vendor_failure;

/// <summary>
/// OpenAI answers a spent quota with a 429 coded insufficient_quota.
/// </summary>
public class and_it_carries_an_openai_insufficient_quota_code : Specification
{
    bool _result;

    void Because() => _result = QuotaExhaustion.IsIndicatedBy(429, "insufficient_quota", """{"error":{"type":"insufficient_quota","code":"insufficient_quota","message":"You exceeded your current quota, please check your plan and billing details."}}""");

    [Fact] void should_be_quota_exhausted() => _result.ShouldBeTrue();
}
