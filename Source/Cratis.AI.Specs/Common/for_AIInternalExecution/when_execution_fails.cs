// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;

namespace Cratis.AI.Common.for_AIInternalExecution;

public class when_execution_fails : Specification
{
    bool _activeAfterFailure;

    async Task Because()
    {
        try
        {
            using var scope = AIInternalExecution.Begin(Substitute.For<ISystemExecution>());
            await Task.Yield();
            throw new InvalidOperationException("Execution failed");
        }
        catch (InvalidOperationException)
        {
            _activeAfterFailure = AIInternalExecution.IsActive;
        }
    }

    [Fact] void should_clear_internal_execution() => _activeAfterFailure.ShouldBeFalse();
}
