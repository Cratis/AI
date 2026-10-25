// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_AIProviderApiKey.when_releasing_for_use;

public class with_encrypted_envelopes : Specification
{
    static readonly string[] _envelopes = ["enc:v1:secret-payload", "enc:v99:secret-payload", "  ENC:unknown:secret-payload"];
    Exception?[] _errors = [];

    void Because() => _errors = [.. _envelopes.Select(value => Catch.Exception(() => new AIProviderApiKey(value).ForUse()))];

    [Fact] void should_require_reconfiguration_for_every_envelope() => _errors.All(error => error is AIProviderRequiresReconfiguration).ShouldBeTrue();
    [Fact] void should_never_include_the_secret_in_diagnostics() => _errors.All(error => !error!.ToString().Contains("secret-payload", StringComparison.Ordinal)).ShouldBeTrue();
    [Fact] void should_not_attach_credential_data() => _errors.All(error => error!.Data.Count == 0).ShouldBeTrue();
}
