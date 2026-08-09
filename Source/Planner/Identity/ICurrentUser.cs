// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Identity;

/// <summary>
/// Defines access to the user behind the current request, when there is one - commands executed
/// from automation (reactors, grains, webhooks) have no user.
/// </summary>
public interface ICurrentUser
{
    /// <summary>
    /// Gets the login of the current user, or <see cref="UserName.NotSet"/> when the execution has
    /// no authenticated user.
    /// </summary>
    /// <returns>The <see cref="UserName"/>.</returns>
    UserName GetUserName();
}
