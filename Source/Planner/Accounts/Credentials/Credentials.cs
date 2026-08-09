// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Accounts.SettingToken;

namespace Planner.Accounts.Credentials;

/// <summary>
/// Passive read model exposing an account's Claude CLI token for the scheduler when it launches a
/// worker. Passive keeps it out of the queryable database - it is only resolved by explicit key
/// from command-side and orchestration code, never exposed through a query.
/// </summary>
/// <param name="Id">The account identity.</param>
/// <param name="Token">The token the Claude CLI authenticates with.</param>
[ReadModel]
[Passive]
[FromEvent<ClaudeAccountTokenSet>]
public record AccountCredentials(AccountId Id, ClaudeToken Token);
