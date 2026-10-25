// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_QuotaExhaustion.when_classifying_a_vendor_failure;

/// <summary>
/// Anthropic answers an empty credit balance with a 400 that says so in words only.
/// </summary>
public class and_it_says_the_credit_balance_is_too_low : Specification
{
    bool _result;

    void Because() => _result = QuotaExhaustion.IsIndicatedBy(400, null, """{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}""");

    [Fact] void should_be_quota_exhausted() => _result.ShouldBeTrue();
}
