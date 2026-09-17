// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Compliance.GDPR;

namespace Cratis.AI.Providers.for_AIProviderApiKey;

/// <summary>
/// A regression guard for Cratis/Direct#998: the port that split this type out of Direct dropped its
/// <see cref="PIIAttribute"/> marking, which put every subsequent Add/Reconfigure command's plaintext
/// API key on the causation chain and would have made Direct's already-stored provider events
/// undecryptable, until a human happened to notice. Nothing asserted the marking was there, so
/// nothing caught the drop - this exists so the next drop fails a build instead of a review.
/// </summary>
public class when_checking_compliance_metadata : Specification
{
    static readonly PIIMetadataProvider _compliance = new();

    [Fact]
    void should_be_marked_pii() =>
        Attribute.IsDefined(typeof(AIProviderApiKey), typeof(PIIAttribute)).ShouldBeTrue();

    [Fact]
    void should_be_recognized_by_chronicles_own_compliance_metadata_provider() =>
        _compliance.CanProvide(typeof(AIProviderApiKey)).ShouldBeTrue();
}
