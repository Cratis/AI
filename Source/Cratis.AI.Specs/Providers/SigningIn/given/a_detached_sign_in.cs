// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.AI.Providers.Copilot;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Cratis.Arc.Tenancy;
using Cratis.Chronicle;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.SigningIn.given;

public class a_detached_sign_in : Specification
{
    protected readonly AIProviderId _provider = AIProviderId.New();
    protected readonly List<(EventSourceId Source, object Event)> _events = [];
    protected readonly List<(EventStoreName Store, EventStoreNamespaceName Namespace)> _destinations = [];
    protected readonly TaskCompletionSource _release = new(TaskCreationOptions.RunContinuationsAsynchronously);
    protected readonly TaskCompletionSource _finished = new(TaskCreationOptions.RunContinuationsAsynchronously);
    protected readonly IHttpRequestContextAccessor _requests = new HttpRequestContextAccessor();
    protected IChronicleClient _client;
    protected IEventStore _store;
    protected ITenantIdAccessor _tenants;
    protected IOptions<ChronicleClientOptions> _options;
    protected ConfiguredAIProvider? _current;
    protected ClaimsPrincipal _principal;
    protected IHttpRequestContext _request;
    protected bool _denied;
    protected bool _internalDuringRecording;
    protected IHttpRequestContext? _requestDuringRecording;
    protected ClaimsPrincipal? _principalDuringRecording;
    protected string? _ambientDuringRecording;
    protected bool _throwOnFirstFailure;
    protected int _failureAttempts;
    protected TenantId _tenant = new("sign-in-tenant");
    readonly AsyncLocal<string?> _ambient = new();

    void Establish()
    {
        _principal = new(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Member")], "test"));
        _request = Substitute.For<IHttpRequestContext>();
        _client = Substitute.For<IChronicleClient>();
        _store = Substitute.For<IEventStore>();
        _tenants = Substitute.For<ITenantIdAccessor>();
        _options = Options.Create(new ChronicleClientOptions { EventStore = "sign-in-store" });
        _client.GetEventStore(Arg.Any<EventStoreName>(), Arg.Any<EventStoreNamespaceName>()).Returns(call =>
        {
            _destinations.Add((call.Arg<EventStoreName>(), call.Arg<EventStoreNamespaceName>()));
            _internalDuringRecording = AIInternalExecution.IsActive;
            _requestDuringRecording = _requests.Current;
            _principalDuringRecording = new CurrentPrincipalAccessor(_requests).Current;
            _ambientDuringRecording = _ambient.Value;
            return Task.FromResult(_store);
        });
        _store.ReadModels.GetInstanceById<ConfiguredAIProvider>(Arg.Any<ReadModelKey>()).Returns(_ => Task.FromResult(_current!));
        _store.EventLog.Append(Arg.Any<EventSourceId>(), Arg.Any<object>()).Returns(call =>
            Task.FromResult(Append(call.Arg<EventSourceId>(), call.Arg<object>())));
        _store.EventLog.AppendMany(Arg.Any<EventSourceId>(), Arg.Any<IEnumerable<object>>()).Returns(call =>
        {
            _events.AddRange(call.Arg<IEnumerable<object>>().Select(@event => (call.Arg<EventSourceId>(), @event)));
            return Task.FromResult(new AppendManyResult());
        });
    }

    AppendResult Append(EventSourceId source, object @event)
    {
        if (@event is CopilotSignInFailed or OpenAISubscriptionSignInFailed)
        {
            _failureAttempts++;
            if (_throwOnFirstFailure && _failureAttempts == 1)
            {
                throw new InvalidOperationException("Recording failed");
            }
        }

        _events.Add((source, @event));
        if (@event is CopilotSignInCompleted or CopilotSignInFailed or OpenAISubscriptionSignInCompleted or OpenAISubscriptionSignInFailed)
        {
            _finished.TrySetResult();
        }

        return new AppendResult();
    }

    protected async Task RunDetached(Func<Task> begin)
    {
        _request.User = _principal;
        _requests.Current = _request;
        _ambient.Value = "request-only";
        _tenants.Current.Returns(_tenant);
        var policy = new AIManagementAuthorization(Substitute.For<IAIAdministrators>());
        _denied = !await policy.IsAuthorized(new(_principal, typeof(AIManagementAuthorization), new object()), CancellationToken.None);
        try
        {
            await begin();
            _requests.Current.ShouldEqual(_request);
            _request.User.ShouldEqual(_principal);
            _tenants.Current.Returns(new TenantId("different-tenant"));
            _requests.Current = null;
            _release.TrySetResult();
            await _finished.Task.WaitAsync(TimeSpan.FromSeconds(10));
        }
        finally
        {
            _requests.Current = null;
            _ambient.Value = null;
        }
    }
}
