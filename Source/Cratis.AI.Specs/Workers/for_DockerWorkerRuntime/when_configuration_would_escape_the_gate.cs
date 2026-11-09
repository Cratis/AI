// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime;

public class when_configuration_would_escape_the_gate : Specification
{
    List<Exception> _errors;

    void Because()
    {
        _errors = [];
        foreach (var name in (string[])["../escape", "/absolute", "nested/file", ".", "..", WorkerSecrets.FileName, WorkerSecrets.ReadyFileName, WorkerSecrets.PendingReadyFileName, WorkerPromptFile.FileName])
        {
            var job = new WorkerJob(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string>(), new Dictionary<string, string> { [name] = "fixture-sensitive-value" });
            try
            {
                using var archive = DockerWorkerSecrets.BuildArchive(job);
            }
            catch (Exception exception)
            {
                _errors.Add(exception);
            }
        }
    }

    [Fact] void should_reject_every_reserved_or_non_flat_name() => _errors.Count.ShouldEqual(9);
    [Fact] void should_only_report_sanitized_failures() => _errors.TrueForAll(error => error is DockerWorkerLaunchFailed).ShouldBeTrue();
    [Fact] void should_not_leak_configuration_content() => string.Join(' ', _errors.Select(error => error.ToString())).ShouldNotContain("fixture-sensitive-value");
}
