// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_HostWorkspace.when_validating;

public class the_workspace_contract : given.a_workspace
{
    static readonly string[] RepositoryInputs =
    [
        "GITHUB_TOKEN", "GH_TOKEN", "DIRECT_PUSH_TOKEN_URL", "DIRECT_CLONE_CREDENTIALS",
        "DIRECT_REPOSITORY_URL", "DIRECT_REPOSITORY_URLS", "DIRECT_REPOSITORY_CHECKOUTS",
        "DIRECT_REPOSITORY_CACHE", "DIRECT_BRANCH"
    ];

    Dictionary<string, HostWorkspaceVerdictKind> _results;
    bool _environmentRefused;
    bool _emptyEnvironmentRefused;
    bool _secretsRefused;
    bool _emptySecretsRefused;

    void Because()
    {
        _results = new()
        {
            ["unset"] = WithEnvironment(HostWorkspace.ModeVariable, null),
            ["empty"] = WithEnvironment(HostWorkspace.ModeVariable, string.Empty),
            ["mixed-case"] = WithEnvironment(HostWorkspace.ModeVariable, "Host-Prepared"),
            ["uppercase"] = WithEnvironment(HostWorkspace.ModeVariable, "HOST-PREPARED"),
            ["leading-space"] = WithEnvironment(HostWorkspace.ModeVariable, " host-prepared"),
            ["trailing-space"] = WithEnvironment(HostWorkspace.ModeVariable, "host-prepared "),
            ["clone"] = WithEnvironment(HostWorkspace.ModeVariable, "clone"),
            ["boolean"] = WithEnvironment(HostWorkspace.ModeVariable, "true"),
            ["numeric"] = WithEnvironment(HostWorkspace.ModeVariable, "1"),
            ["missing-path"] = WithEnvironment(HostWorkspace.HostPathVariable, null),
            ["provider"] = WithEnvironment("COPILOT_GITHUB_TOKEN", "synthetic-provider-value"),
            ["bundle"] = WithEnvironment("DIRECT_RUN_MODE", "bundle-diff")
        };
        _environmentRefused = RefusesEveryRepositoryInput(false, "synthetic-fixture-value");
        _emptyEnvironmentRefused = RefusesEveryRepositoryInput(false, string.Empty);
        _secretsRefused = RefusesEveryRepositoryInput(true, "synthetic-fixture-value");
        _emptySecretsRefused = RefusesEveryRepositoryInput(true, string.Empty);
    }

    HostWorkspaceVerdictKind WithEnvironment(string name, string? value)
    {
        var environment = new Dictionary<string, string>(_job.EnvironmentVariables);
        if (value is null)
        {
            environment.Remove(name);
        }
        else
        {
            environment[name] = value;
        }
        return HostWorkspace.Validate(_job with { EnvironmentVariables = environment }, _root).Kind;
    }

    bool RefusesEveryRepositoryInput(bool secret, string value) => RepositoryInputs.All(name =>
        secret
            ? HostWorkspace.Validate(_job with { Secrets = new Dictionary<string, string> { [name] = value } }, _root).Kind == HostWorkspaceVerdictKind.ForbiddenCredential
            : WithEnvironment(name, value) == HostWorkspaceVerdictKind.ForbiddenCredential);

    [Fact] void should_leave_a_legacy_job_unchanged() => _results["unset"].ShouldEqual(HostWorkspaceVerdictKind.NotHostPrepared);
    [Fact] void should_leave_an_empty_mode_unchanged() => _results["empty"].ShouldEqual(HostWorkspaceVerdictKind.NotHostPrepared);
    [Fact] void should_refuse_mixed_case() => _results["mixed-case"].ShouldEqual(HostWorkspaceVerdictKind.UnknownMode);
    [Fact] void should_refuse_uppercase() => _results["uppercase"].ShouldEqual(HostWorkspaceVerdictKind.UnknownMode);
    [Fact] void should_refuse_leading_whitespace() => _results["leading-space"].ShouldEqual(HostWorkspaceVerdictKind.UnknownMode);
    [Fact] void should_refuse_trailing_whitespace() => _results["trailing-space"].ShouldEqual(HostWorkspaceVerdictKind.UnknownMode);
    [Fact] void should_not_accept_an_explicit_clone_mode() => _results["clone"].ShouldEqual(HostWorkspaceVerdictKind.UnknownMode);
    [Fact] void should_not_accept_a_boolean_mode() => _results["boolean"].ShouldEqual(HostWorkspaceVerdictKind.UnknownMode);
    [Fact] void should_not_accept_a_numeric_mode() => _results["numeric"].ShouldEqual(HostWorkspaceVerdictKind.UnknownMode);
    [Fact] void should_require_the_host_path() => _results["missing-path"].ShouldEqual(HostWorkspaceVerdictKind.PathMissing);
    [Fact] void should_refuse_repository_environment_values() => _environmentRefused.ShouldBeTrue();
    [Fact] void should_refuse_empty_repository_environment_values() => _emptyEnvironmentRefused.ShouldBeTrue();
    [Fact] void should_refuse_repository_secrets() => _secretsRefused.ShouldBeTrue();
    [Fact] void should_refuse_empty_repository_secrets() => _emptySecretsRefused.ShouldBeTrue();
    [Fact] void should_allow_provider_authentication() => _results["provider"].ShouldEqual(HostWorkspaceVerdictKind.Valid);
    [Fact] void should_refuse_bundle_diff() => _results["bundle"].ShouldEqual(HostWorkspaceVerdictKind.ConflictsWithBundleDiff);
}
