// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Accounts.ChangingPlan;
using Planner.Accounts.Registering;
using Planner.Accounts.Removing;
using Planner.Accounts.SettingToken;

namespace Planner.Accounts.Listing;

/// <summary>
/// Read model for listing the Claude accounts. The token itself is deliberately not part of this
/// model - only whether one has been set; the scheduler reads the token through the passive
/// <see cref="Credentials.AccountCredentials"/> model.
/// </summary>
/// <param name="Id">The account identity.</param>
/// <param name="Name">The display name of the account.</param>
/// <param name="Plan">The subscription plan of the account.</param>
/// <param name="RegisteredBy">The login of the user that registered the account.</param>
/// <param name="HasToken">Whether a Claude CLI token has been set for the account.</param>
[ReadModel]
[FromEvent<ClaudeAccountRegistered>]
[RemovedWith<ClaudeAccountRemoved>]
public record ClaudeAccount(
    AccountId Id,
    AccountName Name,
    [SetFrom<ClaudeAccountPlanChanged>]
    ClaudePlan Plan,
    UserName RegisteredBy,
    [SetValue<ClaudeAccountTokenSet>(true)]
    bool HasToken = false)
{
    /// <summary>
    /// Observes all Claude accounts.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the accounts.</param>
    /// <returns>An observable of all accounts.</returns>
    public static ISubject<IEnumerable<ClaudeAccount>> AllAccounts(IMongoCollection<ClaudeAccount> collection) =>
        collection.Observe();
}
