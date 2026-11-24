// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.Defining.when_validating_assignments;

public class and_the_provider_lacks_capabilities : given.assignment_validators
{
    void Establish()
    {
        KnownProvider();
        _compatibility.Supports("IssueTriage", AIProviderType.Anthropic).Returns(false);
    }

    Task Because() => ValidateProvider();

    [Fact] void should_reject_the_assignment() => _results.ShouldEachConformTo(result => !result.IsValid);
    [Fact] void should_report_missing_capabilities() => _results.ShouldEachConformTo(result =>
        result.Errors.Exists(error => error.ErrorMessage.Contains("does not satisfy the capabilities required by this agent")));
}
