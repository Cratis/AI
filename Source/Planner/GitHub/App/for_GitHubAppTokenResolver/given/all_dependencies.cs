// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Planner.GitHub.App.Installations;

namespace Planner.GitHub.App.for_GitHubAppTokenResolver.given;

public class all_dependencies : Specification
{
    protected IGitHubAppClient _appClient;
    protected IMongoCollection<GitHubAppInstallation> _installations;
    protected GitHubAppOptions _options;
    protected GitHubAppTokenResolver _resolver;

    protected List<GitHubAppInstallation> _installationsData;

    void Establish()
    {
        _installationsData = [];

        _appClient = Substitute.For<IGitHubAppClient>();
        _appClient.GetInstallationToken(Arg.Any<InstallationId>(), Arg.Any<CancellationToken>()).Returns("installation-token");

        _installations = Substitute.For<IMongoCollection<GitHubAppInstallation>>();
        _installations.FindAsync(Arg.Any<FilterDefinition<GitHubAppInstallation>>(), Arg.Any<FindOptions<GitHubAppInstallation, GitHubAppInstallation>>(), Arg.Any<CancellationToken>())
            .Returns(_ => CursorOf(_installationsData));

        _options = new() { AppId = "42", PrivateKeyPem = "-----BEGIN RSA PRIVATE KEY-----" };

        _resolver = new(_appClient, _installations, Options.Create(_options));
    }

    static IAsyncCursor<T> CursorOf<T>(IEnumerable<T> items)
    {
        var materialized = items.ToList();
        var cursor = Substitute.For<IAsyncCursor<T>>();
        cursor.Current.Returns(materialized);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(true, false);
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(true), Task.FromResult(false));
        return cursor;
    }
}
#endif
