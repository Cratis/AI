// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime;

public class when_building_the_secret_payload : Specification
{
    IReadOnlyDictionary<string, string> _files;

    void Because()
    {
        var job = new WorkerJob(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string> { ["TOKEN"] = "fixture-value" }, new Dictionary<string, string> { ["config.json"] = "{}" });
        _files = DockerWorkerSecrets.BuildPayload(job);
    }

    [Fact] void should_include_the_secret_assignments() => _files[WorkerSecrets.FileName].ShouldContain("fixture-value");
    [Fact] void should_deliver_prompt_and_configuration() => _files.Keys.ShouldEqual([WorkerSecrets.FileName, WorkerPromptFile.FileName, "config.json"]);
    [Fact] void should_never_release_the_gate_from_the_payload() => _files.ContainsKey(WorkerSecrets.ReadyFileName).ShouldBeFalse();
    [Fact] void should_preserve_configuration_content() => _files["config.json"].ShouldEqual("{}");
}
