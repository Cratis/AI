// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Arc.Authorization;

namespace Planner.Identity.for_DenyByDefaultAuthorization.given;

/// <summary>
/// A command-shaped type carrying a real <see cref="AuthorizeAttribute"/> with roles, on the type itself.
/// </summary>
[Authorize(Roles = "Admin")]
public record CommandWithAuthorize
{
    /// <summary>
    /// A method carrying no authorization attribute of its own - the type's attribute is what applies.
    /// </summary>
    public void Handle()
    {
    }
}
#endif
