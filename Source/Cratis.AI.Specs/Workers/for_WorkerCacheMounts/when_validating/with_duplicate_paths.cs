// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_duplicate_paths : Specification
{
    WorkerCacheMounts _plan;

    void Because() => _plan = WorkerCacheMounts.Create(new("v1-" + new string('a', 64), ["repo.git", "repo.git", "Repo.git"]));

    [Fact] void should_collapse_ordinal_duplicates() => _plan.Repositories.Count.ShouldEqual(2);
    [Fact] void should_preserve_different_casing() => _plan.Repositories.ShouldContain("Repo.git");
}
