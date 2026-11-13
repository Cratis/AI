// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_valid_access : Specification
{
    const string Key = "v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    WorkerCacheMounts _plan;
    bool _valid;

    void Because() => _valid = WorkerCacheMounts.TryCreate(new(Key, ["repo.git", "a/b/c.git"]), out _plan);

    [Fact] void should_accept_the_request() => _valid.ShouldBeTrue();
    [Fact] void should_preserve_nested_owner_segments() => _plan.Repositories.ShouldContain("a/b/c.git");
    [Fact] void should_select_only_the_memory_key() => _plan.MemoryDirectory.ShouldEqual($".agent-memory/{Key}");
}
