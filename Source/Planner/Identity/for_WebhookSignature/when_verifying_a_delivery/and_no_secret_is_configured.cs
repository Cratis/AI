// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Identity.for_WebhookSignature.when_verifying_a_delivery;

/// <summary>
/// The webhook endpoints are public, and everything they accept schedules agent work or rewrites
/// repository state - so an unconfigured secret has to reject, never wave through.
/// </summary>
public class and_no_secret_is_configured : Specification
{
    bool _unsignedDelivery;
    bool _signedDelivery;

    void Because()
    {
        _unsignedDelivery = WebhookSignature.IsValid(string.Empty, "{}", string.Empty);
        _signedDelivery = WebhookSignature.IsValid($"{WebhookSignature.Prefix}{new string('a', WebhookSignature.HexLength)}", "{}", string.Empty);
    }

    [Fact]
    void should_reject_an_unsigned_delivery() => _unsignedDelivery.ShouldBeFalse();

    [Fact]
    void should_reject_a_signed_delivery_too() => _signedDelivery.ShouldBeFalse();
}
#endif
