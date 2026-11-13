// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_KubernetesWorkerCacheVerification.when_checking;

public class with_noncanonical_paths : given.cache_directories
{
    [Theory]
    [InlineData("owner/../allowed.git")]
    [InlineData("owner/./group/allowed.git")]
    [InlineData("/owner/group/allowed.git")]
    [InlineData("owner//group/allowed.git")]
    [InlineData("owner/group/allowed.git/")]
    [InlineData("")]
    [InlineData("missing.git")]
    void should_refuse_the_path(string path) => Verify(Memory, path).ShouldNotEqual(0);

    [Fact]
    void should_refuse_a_file_instead_of_a_directory()
    {
        File.WriteAllText(Path.Combine(_root.FullName, "file.git"), "fixture");
        Verify(Memory, "file.git").ShouldNotEqual(0);
    }
}
