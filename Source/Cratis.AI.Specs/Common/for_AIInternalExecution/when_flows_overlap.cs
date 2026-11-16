// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;

namespace Cratis.AI.Common.for_AIInternalExecution;

public class when_flows_overlap : Specification
{
    readonly IHttpRequestContextAccessor _requests = new HttpRequestContextAccessor();
    readonly TaskCompletionSource _entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
    readonly TaskCompletionSource _observed = new(TaskCreationOptions.RunContinuationsAsynchronously);
    ClaimsPrincipal? _otherPrincipal;
    ClaimsPrincipal? _restoredPrincipal;
    ClaimsPrincipal? _systemPrincipal;
    readonly ClaimsPrincipal _member = new(new ClaimsIdentity([], "test"));
    bool _otherActive;

    async Task Because()
    {
        var request = Substitute.For<IHttpRequestContext>();
        request.User.Returns(_member);
        _requests.Current = request;
        try
        {
            var executing = Execute();
            await _entered.Task;
            _otherPrincipal = new CurrentPrincipalAccessor(_requests).Current;
            _otherActive = AIInternalExecution.IsActive;
            _observed.SetResult();
            await executing;
        }
        finally
        {
            _requests.Current = null;
        }
    }

    async Task Execute()
    {
        var principals = new CurrentPrincipalAccessor(_requests);
        using (AIInternalExecution.Begin(new SystemExecution(principals), _requests))
        {
            _entered.SetResult();
            await _observed.Task;
            _systemPrincipal = principals.Current;
        }
        _restoredPrincipal = principals.Current;
    }

    [Fact] void should_not_change_the_other_flows_principal() => _otherPrincipal.ShouldBeSame(_member);
    [Fact] void should_not_activate_internal_execution_in_the_other_flow() => _otherActive.ShouldBeFalse();
    [Fact] void should_use_the_system_principal_across_await() => _systemPrincipal!.Identity!.AuthenticationType.ShouldEqual(SystemPrincipal.AuthenticationType);
    [Fact] void should_restore_the_executing_flows_principal() => _restoredPrincipal.ShouldBeSame(_member);
}
