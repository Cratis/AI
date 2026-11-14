// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.for_WorkInitiation;

public class when_work_throws : Specification
{
    readonly WorkInitiation _initiation = new();
    WorkInitiator _restored;

    void Because()
    {
        using var outer = _initiation.Begin(WorkInitiator.By("alice"));
        try
        {
            using var inner = _initiation.Begin(WorkInitiator.By("alice"));
            throw new InvalidOperationException();
        }
        catch (InvalidOperationException)
        {
            _restored = _initiation.Current;
        }
    }

    [Fact] void should_restore_the_outer_initiator() => _restored.ShouldEqual(WorkInitiator.By("alice"));
}
