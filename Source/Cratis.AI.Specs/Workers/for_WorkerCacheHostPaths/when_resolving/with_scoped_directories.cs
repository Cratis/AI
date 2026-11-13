// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheHostPaths.when_resolving;

public class with_scoped_directories : Specification
{
    const string Key = "v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    DirectoryInfo _root;
    WorkerCacheHostPaths _result;
    string _memory;

    void Establish()
    {
        _root = Directory.CreateTempSubdirectory();
        Directory.CreateDirectory(Path.Combine(_root.FullName, "owner", "allowed.git"));
        _memory = Path.Combine(_root.FullName, ".agent-memory", Key);
    }

    void Because() => _result = WorkerCacheHostPaths.Resolve(WorkerCacheMounts.Create(new(Key, [new("https://example.invalid/owner/allowed.git", "owner/allowed.git"), new("https://example.invalid/owner/missing.git", "owner/missing.git")])), _root.FullName, true);

    [Fact] void should_accept_the_directories() => _result.IsValid.ShouldBeTrue();
    [Fact] void should_bind_the_repository_read_only() => _result.Binds.ShouldContain($"{_root.FullName}/owner/allowed.git:{_root.FullName}/owner/allowed.git:ro");
    [Fact] void should_not_bind_a_missing_repository() => _result.Binds.ShouldNotContain(bind => bind.Contains("missing.git", StringComparison.Ordinal));
    [Fact] void should_report_a_missing_repository() => _result.HasMissingRepositories.ShouldBeTrue();
    [Fact] void should_not_create_a_missing_mirror() => Directory.Exists(Path.Combine(_root.FullName, "owner", "missing.git")).ShouldBeFalse();
    [Fact] void should_create_the_memory_directory() => Directory.Exists(_memory).ShouldBeTrue();
    [Fact] void should_bind_only_the_key_read_write() => _result.Binds.Single(bind => bind.EndsWith(":rw", StringComparison.Ordinal)).ShouldEqual($"{_memory}:{_memory}:rw");

    void Destroy() => _root.Delete(true);
}
