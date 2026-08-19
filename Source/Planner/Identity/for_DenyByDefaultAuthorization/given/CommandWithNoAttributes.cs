// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Identity.for_DenyByDefaultAuthorization.given;

/// <summary>
/// A command-shaped type carrying no authorization attribute anywhere, on the type or the method.
/// </summary>
public record CommandWithNoAttributes
{
    /// <summary>
    /// A method carrying no authorization attribute of its own either.
    /// </summary>
    public void Handle()
    {
    }
}
#endif
