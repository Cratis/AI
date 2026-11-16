// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Http;

namespace Cratis.AI.Common.for_AIInternalExecution;

public class when_the_scope_ends : Specification
{
    bool _inside;
    bool _afterNestedScope;
    bool _outside;
    bool _capturedAfterDisposal;

    async Task Because()
    {
        var requests = new HttpRequestContextAccessor();
        var systemExecution = new SystemExecution(new CurrentPrincipalAccessor(requests));
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Task<bool> captured;
        using (AIInternalExecution.Begin(systemExecution, requests))
        {
            await Task.Yield();
            _inside = AIInternalExecution.IsActive;
            using (AIInternalExecution.Begin(systemExecution, requests))
            {
                await Task.Yield();
            }

            _afterNestedScope = AIInternalExecution.IsActive;
            captured = Task.Run(async () =>
            {
                await release.Task;
                return AIInternalExecution.IsActive;
            });
        }

        _outside = AIInternalExecution.IsActive;
        release.SetResult();
        _capturedAfterDisposal = await captured;
    }

    [Fact] void should_flow_across_awaits() => _inside.ShouldBeTrue();
    [Fact] void should_restore_the_outer_scope() => _afterNestedScope.ShouldBeTrue();
    [Fact] void should_clear_the_marker_on_disposal() => _outside.ShouldBeFalse();
    [Fact] void should_clear_the_marker_in_captured_execution() => _capturedAfterDisposal.ShouldBeFalse();
}
