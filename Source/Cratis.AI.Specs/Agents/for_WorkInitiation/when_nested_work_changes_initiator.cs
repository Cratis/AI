// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.for_WorkInitiation;

public class when_nested_work_changes_initiator : Specification
{
    readonly WorkInitiation _initiation = new();
    Exception _error;
    WorkInitiator _current;

    void Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By("alice"));
        _error = Catch.Exception(() => _initiation.Begin(WorkInitiator.By("bob")));
        _current = _initiation.Current;
    }

    [Fact] void should_reject_rebinding() => _error.ShouldBeOfExactType<InvalidOperationException>();
    [Fact] void should_keep_the_original_member() => _current.ShouldEqual(WorkInitiator.By("alice"));
}
