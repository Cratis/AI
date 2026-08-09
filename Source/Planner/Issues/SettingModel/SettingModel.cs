// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.SettingModel;

/// <summary>
/// Command for overriding the model used to implement an issue. Takes precedence over any model an
/// investigation suggested - pass <see cref="ModelName.NotSet"/> to clear the override and fall
/// back to the investigation's suggestion (or the scheduler's configured default).
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Model">The model to use, or <see cref="ModelName.NotSet"/> to clear the override.</param>
[Command]
public record SetIssueModel(IssueId Issue, ModelName Model)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueModelOverridden"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueModelOverridden Handle() => new(Model);
}

/// <summary>
/// Event raised when the model used to implement an issue has been explicitly set (or cleared back
/// to automatic, when <see cref="Model"/> is <see cref="ModelName.NotSet"/>).
/// </summary>
/// <param name="Model">The model to use, or <see cref="ModelName.NotSet"/> for automatic.</param>
[EventType]
public record IssueModelOverridden(ModelName Model);
