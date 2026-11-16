// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.OpenAI;
using Cratis.AI.Providers.Refreshing;
using Cratis.Chronicle;

namespace Cratis.AI.Providers.SigningIn.for_OpenAISubscriptionSignIns;

public class when_a_denied_member_is_present : given.a_sign_in
{
    Task Because() => SignIn();

    [Fact] void should_deny_the_request_principal_management_access() => _denied.ShouldBeTrue();
    [Fact] void should_return_the_user_code() => _started!.UserCode.ShouldEqual("code");
    [Fact] void should_record_the_credential_first() => _events[0].Event.ShouldEqual(new OpenAISubscriptionCredentialRefreshed(_credential.ToApiKey()));
    [Fact] void should_record_the_expiry_second() => _events[1].Event.ShouldEqual(new OpenAISubscriptionCredentialConfigured(_credential.ExpiresAt));
    [Fact] void should_complete_the_sign_in_last() => _events[2].Event.ShouldBeOfExactType<OpenAISubscriptionSignInCompleted>();
    [Fact] void should_only_record_the_expected_events() => _events.Count.ShouldEqual(3);
    [Fact] void should_use_the_provider_stream() => _events.TrueForAll(entry => entry.Source == (EventSourceId)_provider).ShouldBeTrue();
    [Fact] void should_keep_the_captured_destination() => _destinations.TrueForAll(destination => destination == (new EventStoreName("sign-in-store"), new EventStoreNamespaceName(_tenant.Value))).ShouldBeTrue();
    [Fact] void should_not_inherit_the_request() => _requestDuringRecording.ShouldBeNull();
    [Fact] void should_not_inherit_a_principal() => _principalDuringRecording.ShouldBeNull();
    [Fact] void should_not_inherit_execution_context() => _ambientDuringRecording.ShouldBeNull();
    [Fact] void should_not_enter_internal_execution() => _internalDuringRecording.ShouldBeFalse();
    [Fact] void should_leave_the_request_principal_unchanged() => _request.User.ShouldEqual(_principal);
    [Fact] void should_not_depend_on_a_command_pipeline() => typeof(OpenAISubscriptionSignIns).GetConstructors().SelectMany(constructor => constructor.GetParameters()).Any(parameter => parameter.ParameterType == typeof(ICommandPipeline)).ShouldBeFalse();
}
