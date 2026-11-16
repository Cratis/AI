// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.AI.Providers.Refreshing;
using Cratis.Arc.Tenancy;
using Cratis.Chronicle;

namespace Cratis.AI.Providers.SigningIn.for_OpenAISubscriptionSignIns;

public class when_an_anonymous_request_is_present : given.a_sign_in
{
    void Establish()
    {
        _principal = new(new ClaimsIdentity());
        _tenant = TenantId.Default;
    }

    Task Because() => SignIn();

    [Fact] void should_deny_the_request_principal_management_access() => _denied.ShouldBeTrue();
    [Fact] void should_record_the_credential() => _events[0].Event.ShouldEqual(new OpenAISubscriptionCredentialRefreshed(_credential.ToApiKey()));
    [Fact] void should_complete_the_sign_in() => _events[2].Event.ShouldBeOfExactType<OpenAISubscriptionSignInCompleted>();
    [Fact] void should_use_the_default_namespace() => _destinations.TrueForAll(destination => destination.Namespace == EventStoreNamespaceName.Default).ShouldBeTrue();
    [Fact] void should_not_inherit_the_request() => _requestDuringRecording.ShouldBeNull();
    [Fact] void should_not_promote_the_request_principal() => _request.User.ShouldEqual(_principal);
    [Fact] void should_not_establish_a_system_principal() => _principalDuringRecording.ShouldBeNull();
    [Fact] void should_not_enter_internal_execution() => _internalDuringRecording.ShouldBeFalse();
}
