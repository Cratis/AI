// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Formats.Tar;
using Cratis.AI.Usage;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime;

public class when_building_the_secret_archive : Specification
{
    List<TarEntry> _entries;
    string _secrets;

    void Because()
    {
        var job = new WorkerJob(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string> { ["TOKEN"] = "fixture-value" }, new Dictionary<string, string> { ["config.json"] = "{}" });
        using var archive = DockerWorkerSecrets.BuildArchive(job);
        using var reader = new TarReader(archive);
        _entries = [];
        while (reader.GetNextEntry() is { } entry)
        {
            _entries.Add(entry);
            if (entry.Name == WorkerSecrets.FileName)
            {
                using var text = new StreamReader(entry.DataStream!);
                _secrets = text.ReadToEnd();
            }
        }
    }

    [Fact] void should_include_the_secret_assignments() => _secrets.ShouldContain("TOKEN='fixture-value'");
    [Fact] void should_deliver_prompt_and_configuration() => _entries.Select(entry => entry.Name).ShouldEqual([WorkerSecrets.FileName, WorkerPromptFile.FileName, "config.json"]);
    [Fact] void should_never_release_the_gate_from_the_payload() => _entries.Exists(entry => entry.Name == WorkerSecrets.ReadyFileName).ShouldBeFalse();
    [Fact] void should_allow_only_owner_read() => _entries.TrueForAll(entry => entry.Mode == UnixFileMode.UserRead).ShouldBeTrue();
    [Fact] void should_assign_the_image_user() => _entries.TrueForAll(entry => entry.Uid == 1655 && entry.Gid == 1655).ShouldBeTrue();
}
