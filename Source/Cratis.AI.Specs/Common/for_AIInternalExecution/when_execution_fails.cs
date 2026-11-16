// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;

namespace Cratis.AI.Common.for_AIInternalExecution;

public class when_execution_fails : Specification
{
    readonly IHttpRequestContextAccessor _requests = new HttpRequestContextAccessor();
    readonly IHttpRequestContext _request = Substitute.For<IHttpRequestContext>();
    readonly ClaimsPrincipal _principal = new(new ClaimsIdentity([], "test"));
    bool _activeAfterFailure;
    IHttpRequestContext? _requestAfterFailure;
    ClaimsPrincipal? _principalAfterFailure;

    void Establish() => _request.User.Returns(_principal);

    async Task Because()
    {
        _requests.Current = _request;
        var principals = new CurrentPrincipalAccessor(_requests);
        try
        {
            using var scope = AIInternalExecution.Begin(new SystemExecution(principals), _requests);
            await Task.Yield();
            throw new InvalidOperationException("Execution failed");
        }
        catch (InvalidOperationException)
        {
            _activeAfterFailure = AIInternalExecution.IsActive;
            _requestAfterFailure = _requests.Current;
            _principalAfterFailure = principals.Current;
        }
        finally
        {
            _requests.Current = null;
        }
    }

    [Fact] void should_clear_internal_execution() => _activeAfterFailure.ShouldBeFalse();
    [Fact] void should_restore_the_request() => _requestAfterFailure.ShouldBeSame(_request);
    [Fact] void should_restore_the_principal() => _principalAfterFailure.ShouldBeSame(_principal);
    [Fact] void should_preserve_the_request_principal() => _request.User.ShouldBeSame(_principal);
}
