// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.Options;
using NSubstitute.ReturnsExtensions;
using Planner.Accounts;
using Planner.Accounts.Credentials;
using Planner.GitHub.App;
using Planner.GitHub.GitIdentity.Listing;
using Planner.Operations;
using ListedAlert = Planner.Alerts.Listing.Alert;
using Repository = Planner.Repositories.Listing.Repository;

namespace Planner.Work.Workers.for_WorkerEnvironment.given;

public class all_dependencies : Specification
{
    protected static readonly WorkId _workId = WorkId.New();
    protected static readonly CallbackToken _callbackToken = CallbackToken.New();

    protected IReadModels _readModels;
    protected IGitHubAppTokenResolver _gitHubAppTokenResolver;
    protected WorkerOptions _workerOptions;
    protected OperationsOptions _operationsOptions;
    protected AccountCredentials _credentials;
    protected WorkerEnvironment _environment;

    void Establish()
    {
        _readModels = Substitute.For<IReadModels>();
        _readModels.GetInstanceById<Repository>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>()).ReturnsNull();
        _readModels.GetInstanceById<ConfiguredGitIdentity>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>()).ReturnsNull();
        _readModels.GetInstanceById<ListedAlert>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>()).ReturnsNull();

        _gitHubAppTokenResolver = Substitute.For<IGitHubAppTokenResolver>();
        _gitHubAppTokenResolver.GetToken(Arg.Any<OrganizationName>(), Arg.Any<CancellationToken>()).Returns("installation-token");

        _workerOptions = new();
        _operationsOptions = new();
        _credentials = new(AccountId.New(), "sk-ant-token");
    }

    protected void BuildEnvironmentBuilder() =>
        _environment = new(
            _readModels,
            _gitHubAppTokenResolver,
            Options.Create(_workerOptions),
            Options.Create(_operationsOptions));
}
#endif
