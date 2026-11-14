// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.for_WorkInitiation;

public class when_nested_work_finishes : Specification
{
    readonly WorkInitiation _initiation = new();
    WorkInitiator _nested;
    WorkInitiator _restored;

    void Because()
    {
        using var outer = _initiation.Begin(WorkInitiator.By("alice"));
        using (_initiation.Begin(WorkInitiator.By("alice"))) _nested = _initiation.Current;
        _restored = _initiation.Current;
    }

    [Fact] void should_keep_the_nested_initiator() => _nested.ShouldEqual(WorkInitiator.By("alice"));
    [Fact] void should_restore_the_outer_initiator() => _restored.ShouldEqual(WorkInitiator.By("alice"));
    [Fact] void should_restore_unknown_after_work_finishes() => _initiation.Current.ShouldEqual(WorkInitiator.None);
}
