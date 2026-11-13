// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheMounts.when_validating;

public class with_an_absolute_path : Specification
{
    [Fact] void should_refuse_the_path() => WorkerCacheMounts.TryCreate(new("v1-" + new string('a', 64), [new("https://example.invalid/repo.git", "/a/b.git")]), out _).ShouldBeFalse();
}
