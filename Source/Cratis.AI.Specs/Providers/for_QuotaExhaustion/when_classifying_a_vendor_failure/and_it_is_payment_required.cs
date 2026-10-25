// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_QuotaExhaustion.when_classifying_a_vendor_failure;

/// <summary>
/// An OpenAI-compatible gateway answers missing credits with 402 Payment Required.
/// </summary>
public class and_it_is_payment_required : Specification
{
    bool _result;

    void Because() => _result = QuotaExhaustion.IsIndicatedBy(402, null, """{"error":{"message":"Insufficient credits"}}""");

    [Fact] void should_be_quota_exhausted() => _result.ShouldBeTrue();
}
