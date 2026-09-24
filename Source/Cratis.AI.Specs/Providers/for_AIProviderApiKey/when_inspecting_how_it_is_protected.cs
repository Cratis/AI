// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Chronicle.Commands;
using Cratis.Chronicle.ProtectedValues;

namespace Cratis.AI.Providers.for_AIProviderApiKey;

/// <summary>
/// The two attributes on <see cref="AIProviderApiKey"/> are the whole of the package's credential
/// protection - there is no protector left to fall back on. Nothing else fails when they are
/// removed: handlers still compile, every other specification still passes, and keys quietly start
/// being stored and audited in the clear. Hence this.
/// </summary>
public class when_inspecting_how_it_is_protected : Specification
{
    EncryptedAttribute _encrypted;
    NotAuditedAttribute _notAudited;

    void Establish()
    {
        _encrypted = (EncryptedAttribute)Attribute.GetCustomAttribute(typeof(AIProviderApiKey), typeof(EncryptedAttribute))!;
        _notAudited = (NotAuditedAttribute)Attribute.GetCustomAttribute(typeof(AIProviderApiKey), typeof(NotAuditedAttribute))!;
    }

    [Fact] void should_be_encrypted_at_rest() => _encrypted.ShouldNotBeNull();
    [Fact] void should_be_encrypted_for_the_namespace() => _encrypted.Scope.ShouldEqual(EncryptionScope.Namespace);
    [Fact] void should_be_kept_out_of_the_causation_chain() => _notAudited.ShouldNotBeNull();
}
