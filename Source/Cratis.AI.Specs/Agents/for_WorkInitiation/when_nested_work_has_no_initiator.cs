// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.for_WorkInitiation;

public class when_nested_work_has_no_initiator : Specification
{
    readonly WorkInitiation _initiation = new();
    WorkInitiator _current;

    void Because()
    {
        using var outer = _initiation.Begin(WorkInitiator.By("alice"));
        using var inner = _initiation.Begin(WorkInitiator.None);
        _current = _initiation.Current;
    }

    [Fact] void should_not_erase_the_original_member() => _current.ShouldEqual(WorkInitiator.By("alice"));
}
