// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.AI.Common;
using Cratis.AI.Providers.Capacity;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Cratis.Arc.Tenancy;
using Cratis.Types;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.RateLimiting.for_ProviderRateLimitRecorder.given;

public class internal_recording : Specification
{
    protected IHttpRequestContext? _request;
    protected IHttpRequestContext _memberRequest;
    protected IHttpRequestContext? _requestAfterRecording;
    protected ClaimsPrincipal? _recordingPrincipal;
    protected ClaimsPrincipal? _principalAfterRecording;
    protected ClaimsPrincipal? _originalPrincipal;
    protected ClaimsPrincipal? _requestPrincipalDuringRecording;
    protected CommandResult _recorded;
    protected CommandResult _outside;
    protected bool _activeAfterRecording;
    protected readonly TenantId _tenant = new("recording-tenant");
    protected TenantId? _pipelineTenant;
    protected TenantId? _tenantAfterRecording;

    readonly CommandScenario<RecordProviderRateLimited> _scenario = new();
    readonly IHttpRequestContextAccessor _requests = new HttpRequestContextAccessor();
    ProviderRateLimitRecorder _recorder;
    AIProviderId _provider;
    ITenantIdAccessor _tenants;

    void Establish()
    {
        _provider = AIProviderId.New();
        _memberRequest = Substitute.For<IHttpRequestContext>();
        _memberRequest.User.Returns(new ClaimsPrincipal(new ClaimsIdentity("member")));
        _scenario.Services.AddSingleton(_requests);
        _scenario.Services.AddTransient<IAIAdministrators, DenyAIAdministrators>();
        _scenario.Services.AddArcAuthorizationPolicy<AIManagementAuthorization>(AIManagementPolicy.Name);
        ConfigureTenantObservation();
        var pipeline = Substitute.For<ICommandPipeline>();
        pipeline.Execute(Arg.Any<object>()).Returns(call =>
        {
            _recordingPrincipal = new CurrentPrincipalAccessor(_requests).Current;
            _requestPrincipalDuringRecording = _request?.User;
            return _scenario.Execute((RecordProviderRateLimited)call.Arg<object>());
        });
        _recorder = new(
            new UnknownAIProviderCapacities(TimeProvider.System),
            pipeline,
            new SystemExecution(new CurrentPrincipalAccessor(_requests)),
            _requests,
            TimeProvider.System,
            Options.Create(new AIProviderOptions()),
            Substitute.For<ILogger>());
    }

    void ConfigureTenantObservation()
    {
        var options = Options.Create(new Cratis.Arc.ArcOptions());
        _tenants = new TenantIdAccessor(new HeaderTenantIdResolver(_requests, options));
        _scenario.Services.AddSingleton(_tenants);
        var observer = Substitute.For<ICommandExecutionScope>();
        observer.When(scope => scope.Begin(Arg.Any<CommandContext>())).Do(call =>
        {
            if (AIInternalExecution.IsActive)
            {
                _pipelineTenant = call.Arg<CommandContext>().ServiceProvider!.GetRequiredService<ITenantIdAccessor>().Current;
            }
        });
        var scopes = Substitute.For<IInstancesOf<ICommandExecutionScope>>();
        scopes.GetEnumerator().Returns(_ => new List<ICommandExecutionScope> { observer }.GetEnumerator());
        _scenario.Services.AddSingleton(scopes);
    }

    protected async Task RecordAndCheckOutside()
    {
        if (_request is not null)
        {
            var services = Substitute.For<IServiceProvider>();
            services.GetService(typeof(ITenantIdAccessor)).Returns(_tenants);
            _request.RequestServices.Returns(services);
            _request.Headers.Returns(new Dictionary<string, string> { [new Cratis.Arc.ArcOptions().Tenancy.HttpHeader] = _tenant.Value });
        }

        _requests.Current = _request;
        _originalPrincipal = _request?.User;
        try
        {
            await _recorder.Record(_provider, "429");
            _recorded = _scenario.LastResult!;
            _activeAfterRecording = AIInternalExecution.IsActive;
            _requestAfterRecording = _requests.Current;
            _principalAfterRecording = new CurrentPrincipalAccessor(_requests).Current;
            _tenantAfterRecording = _tenants.Current;
            _outside = await _scenario.Execute(new(_provider, DateTimeOffset.UtcNow.AddHours(1)));
        }
        finally
        {
            _requests.Current = null;
        }
    }

    void Destroy() => _scenario.Dispose();
}
