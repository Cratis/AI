// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.AI.Common;
using Cratis.AI.Providers.Capacity;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.RateLimiting.for_ProviderRateLimitRecorder.given;

public class internal_recording : Specification
{
    protected IHttpRequestContext? _request;
    protected IHttpRequestContext _memberRequest;
    protected CommandResult _recorded;
    protected CommandResult _outside;
    protected bool _activeAfterRecording;

    readonly CommandScenario<RecordProviderRateLimited> _scenario = new();
    ProviderRateLimitRecorder _recorder;
    AIProviderId _provider;

    void Establish()
    {
        _provider = AIProviderId.New();
        _memberRequest = Substitute.For<IHttpRequestContext>();
        _memberRequest.User.Returns(new ClaimsPrincipal(new ClaimsIdentity("member")));
        var requests = Substitute.For<IHttpRequestContextAccessor>();
        requests.Current.Returns(_ => _request);
        _scenario.Services.AddSingleton(requests);
        _scenario.Services.AddTransient<IAIAdministrators, DenyAIAdministrators>();
        _scenario.Services.AddArcAuthorizationPolicy<AIManagementAuthorization>(AIManagementPolicy.Name);
        var pipeline = Substitute.For<ICommandPipeline>();
        pipeline.Execute(Arg.Any<object>()).Returns(call => _scenario.Execute((RecordProviderRateLimited)call.Arg<object>()));
        _recorder = new(
            new UnknownAIProviderCapacities(TimeProvider.System),
            pipeline,
            new SystemExecution(new CurrentPrincipalAccessor(requests)),
            TimeProvider.System,
            Options.Create(new AIProviderOptions()),
            Substitute.For<ILogger>());
    }

    protected async Task RecordAndCheckOutside()
    {
        await _recorder.Record(_provider, "429");
        _recorded = _scenario.LastResult!;
        _activeAfterRecording = AIInternalExecution.IsActive;
        _outside = await _scenario.Execute(new(_provider, DateTimeOffset.UtcNow.AddHours(1)));
    }

    void Destroy() => _scenario.Dispose();
}
