// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Http;

namespace Cratis.AI.Common.for_AIInternalExecution;

public class when_starting_execution_fails : Specification
{
    readonly IHttpRequestContextAccessor _requests = new HttpRequestContextAccessor();
    readonly IHttpRequestContext _request = Substitute.For<IHttpRequestContext>();
    bool _activeAfterFailure;
    IHttpRequestContext? _requestAfterFailure;
    Exception? _exception;

    void Because()
    {
        var systemExecution = Substitute.For<ISystemExecution>();
        systemExecution.AsSystem().Returns(_ => throw new InvalidOperationException("Execution failed"));
        _requests.Current = _request;
        try
        {
            _exception = Catch.Exception(() => AIInternalExecution.Begin(systemExecution, _requests));
            _activeAfterFailure = AIInternalExecution.IsActive;
            _requestAfterFailure = _requests.Current;
        }
        finally
        {
            _requests.Current = null;
        }
    }

    [Fact] void should_report_the_failure() => _exception.ShouldBeOfExactType<InvalidOperationException>();
    [Fact] void should_not_leave_internal_execution_active() => _activeAfterFailure.ShouldBeFalse();
    [Fact] void should_restore_the_request() => _requestAfterFailure.ShouldBeSame(_request);
}
