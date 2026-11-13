// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.given;

public class a_launch : Specification
{
    protected IDockerClient _client;
    protected ILogger<DockerWorkerRuntime> _logger;
    protected WorkerJob _job;
    protected List<string> _operations;
    protected List<ContainerExecCreateParameters> _commands;
    protected List<exec_stream> _streams;
    protected Dictionary<string, int> _inspections;
    protected bool _inspectedBeforeDrain;
    protected bool _verifiedBeforePublication;
    protected DockerWorkerRuntime _runtime;
    protected WorkerRuntimeOptions _options;
    protected Exception _error;
    protected WorkerLaunchOutcome _outcome;

    void Establish()
    {
        _client = Substitute.For<IDockerClient>();
        _logger = Substitute.For<ILogger<DockerWorkerRuntime>>();
        _operations = [];
        _commands = [];
        _streams = [];
        _inspections = [];
        _job = new(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string> { ["TOKEN"] = "fixture-sensitive-value" });
        _client.Containers.CreateContainerAsync(Arg.Any<CreateContainerParameters>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new CreateContainerResponse { ID = "worker" }));
        _client.Containers.StartContainerAsync("worker", Arg.Any<ContainerStartParameters>(), Arg.Any<CancellationToken>()).Returns(_ =>
        {
            _operations.Add("start");
            return Task.FromResult(true);
        });
        _client.Exec.CreateContainerExecAsync("worker", Arg.Any<ContainerExecCreateParameters>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            var command = call.Arg<ContainerExecCreateParameters>();
            if (command.Cmd[^1].Contains("printf", StringComparison.Ordinal))
            {
                _verifiedBeforePublication = _inspections.GetValueOrDefault(_commands.Count.ToString(System.Globalization.CultureInfo.InvariantCulture)) == 3;
            }
            _commands.Add(command);
            _operations.Add(command.AttachStdin ? "write" : command.Cmd[^1].Contains("printf", StringComparison.Ordinal) ? "ready" : "verify");
            return Task.FromResult(new ContainerExecCreateResponse { ID = _commands.Count.ToString(System.Globalization.CultureInfo.InvariantCulture) });
        });
        _client.Exec.StartContainerExecAsync(Arg.Any<string>(), Arg.Any<ContainerExecStartParameters>(), Arg.Any<CancellationToken>()).Returns(_ =>
        {
            var stream = new exec_stream();
            _streams.Add(stream);
            return Task.FromResult(new MultiplexedStream(stream, multiplexed: true));
        });
        _client.Exec.InspectContainerExecAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            _inspectedBeforeDrain |= !_streams[^1].Drained;
            var id = call.Arg<string>();
            var attempt = _inspections.GetValueOrDefault(id) + 1;
            _inspections[id] = attempt;
            return Task.FromResult(new ContainerExecInspectResponse { Running = attempt == 1, ExitCode = attempt < 3 ? null : 0 });
        });
        _options = new();
        _runtime = new(Options.Create(_options), _logger);
    }

    protected async Task Launch(CancellationToken cancellationToken = default)
    {
        try
        {
            _outcome = await _runtime.Start(_client, _job, cancellationToken);
        }
        catch (Exception exception)
        {
            _error = exception;
        }
    }
}
