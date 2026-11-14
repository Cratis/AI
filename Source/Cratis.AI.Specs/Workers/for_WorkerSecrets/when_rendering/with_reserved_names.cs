// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerSecrets.when_rendering;

public class with_reserved_names : Specification
{
    [Theory]
    [InlineData("CRATIS_WORKER_REPOSITORY_MIRRORS")]
    [InlineData("cratis_worker_repository_mirrors")]
    [InlineData("DIRECT_MEMORY_PATH")]
    [InlineData("DIRECT_REPOSITORY_CACHE")]
    [InlineData("direct_memory_path")]
    [InlineData("DIRECT_SECRETS_FILE")]
    [InlineData("DIRECT_PROMPT_FILE")]
    [InlineData(WorkerSecrets.RequiredVariableName)]
    [InlineData(WorkerPromptFile.LegacyVariableName)]
    [InlineData("PATH")]
    [InlineData("LD_AUDIT")]
    [InlineData("BASH_ENV")]
    [InlineData("ENV")]
    [InlineData("LD_PRELOAD")]
    [InlineData("LD_LIBRARY_PATH")]
    [InlineData("DYLD_INSERT_LIBRARIES")]
    [InlineData("DYLD_LIBRARY_PATH")]
    [InlineData("CRATIS_WORKSPACE_MODE")]
    [InlineData("CRATIS_WORKSPACE_PATH")]
    [InlineData("CRATIS_WORKSPACE_HOST_PATH")]
    [InlineData("DIRECT_REPOSITORY_CHECKOUTS")]
    void should_refuse_runtime_owned_names(string name)
    {
        var exception = Catch.Exception(() => WorkerSecrets.Render(new Dictionary<string, string> { [name] = "synthetic-value" }));
        exception.ShouldBeOfExactType<ArgumentException>();
        exception.Message.ShouldContain("reserved for worker runtime configuration");
    }

    [Fact]
    void should_refuse_the_configured_cache_name() => Catch.Exception(() => WorkerSecrets.ValidateNames(new Dictionary<string, string> { ["custom_cache"] = "synthetic-value" }, "CUSTOM_CACHE")).ShouldBeOfExactType<ArgumentException>();

    [Fact]
    void should_allow_an_unreserved_secret() => WorkerSecrets.Render(new Dictionary<string, string> { ["ACCESS_KEY"] = "synthetic-value" }).ShouldContain("ACCESS_KEY='synthetic-value'");
}
