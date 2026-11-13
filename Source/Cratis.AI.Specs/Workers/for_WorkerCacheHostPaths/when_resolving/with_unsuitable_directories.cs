// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerCacheHostPaths.when_resolving;

public class with_unsuitable_directories : Specification
{
    const string Key = "v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    [Theory]
    [InlineData("owner")]
    [InlineData("owner/group")]
    [InlineData("owner/group/allowed.git")]
    [InlineData(".agent-memory")]
    [InlineData(".agent-memory/" + Key)]
    void should_refuse_a_symlinked_component(string relative)
    {
        if (OperatingSystem.IsWindows()) return;
        var root = Directory.CreateTempSubdirectory();
        var target = Directory.CreateTempSubdirectory();
        try
        {
            var path = Path.Combine(root.FullName, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            Directory.CreateSymbolicLink(path, target.FullName);
            Resolve(root.FullName).IsValid.ShouldBeFalse();
        }
        finally
        {
            root.Delete(true);
            target.Delete(true);
        }
    }

    [Fact]
    void should_refuse_a_file_component()
    {
        var root = Directory.CreateTempSubdirectory();
        try
        {
            File.WriteAllText(Path.Combine(root.FullName, "owner"), "not a directory");
            Resolve(root.FullName).IsValid.ShouldBeFalse();
        }
        finally
        {
            root.Delete(true);
        }
    }

    [Fact]
    void should_accept_an_operator_configured_root_symlink()
    {
        if (OperatingSystem.IsWindows()) return;
        var root = Directory.CreateTempSubdirectory();
        var target = Directory.CreateTempSubdirectory();
        try
        {
            var link = Path.Combine(root.FullName, "cache");
            Directory.CreateSymbolicLink(link, target.FullName);
            Resolve(link).IsValid.ShouldBeTrue();
        }
        finally
        {
            root.Delete(true);
            target.Delete(true);
        }
    }

    static WorkerCacheHostPaths Resolve(string root) => WorkerCacheHostPaths.Resolve(WorkerCacheMounts.Create(new(Key, [new("https://example.invalid/owner/group/allowed.git", "owner/group/allowed.git")])), root, true);
}
