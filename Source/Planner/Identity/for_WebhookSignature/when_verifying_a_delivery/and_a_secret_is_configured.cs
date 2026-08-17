// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Cryptography;
using System.Text;

namespace Planner.Identity.for_WebhookSignature.when_verifying_a_delivery;

public class and_a_secret_is_configured : Specification
{
    const string _secret = "the-shared-secret";
    const string _body = """{"action":"opened"}""";

    bool _authentic;
    bool _tamperedBody;
    bool _wrongSecret;
    bool _unsigned;
    bool _notHex;

    void Because()
    {
        _authentic = WebhookSignature.IsValid(SignatureOver(_body, _secret), _body, _secret);
        _tamperedBody = WebhookSignature.IsValid(SignatureOver(_body, _secret), """{"action":"closed"}""", _secret);
        _wrongSecret = WebhookSignature.IsValid(SignatureOver(_body, "another-secret"), _body, _secret);
        _unsigned = WebhookSignature.IsValid(string.Empty, _body, _secret);
        _notHex = WebhookSignature.IsValid($"{WebhookSignature.Prefix}{new string('z', WebhookSignature.HexLength)}", _body, _secret);
    }

    static string SignatureOver(string body, string secret) =>
        WebhookSignature.Prefix + Convert.ToHexStringLower(
            HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body)));

    [Fact] void should_accept_an_authentic_delivery() => _authentic.ShouldBeTrue();
    [Fact] void should_reject_a_tampered_body() => _tamperedBody.ShouldBeFalse();
    [Fact] void should_reject_a_delivery_signed_with_another_secret() => _wrongSecret.ShouldBeFalse();
    [Fact] void should_reject_an_unsigned_delivery() => _unsigned.ShouldBeFalse();
    [Fact] void should_reject_a_signature_that_is_not_hex() => _notHex.ShouldBeFalse();
}
#endif
