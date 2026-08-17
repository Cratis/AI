// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Identity;

/// <summary>
/// Represents the configuration for who the Planner accepts as an operator, bound from the
/// <c>Planner:Security</c> configuration section.
/// </summary>
/// <remarks>
/// The Planner does not authenticate anyone itself - it runs behind an authenticating reverse proxy
/// and takes the operator's identity from what that proxy records on the request. Both settings here
/// default to "trust nobody", so an unconfigured deployment refuses every operator action rather
/// than silently accepting anonymous ones.
/// </remarks>
public class SecurityOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:Security";

    /// <summary>
    /// Gets or sets the request header the authenticating ingress records the operator's login in -
    /// <c>X-Forwarded-User</c> for most proxies, <c>X-Auth-Request-User</c> for oauth2-proxy. Empty
    /// (the default) trusts no header at all, which means no request is ever treated as an operator.
    /// </summary>
    /// <remarks>
    /// Setting this makes the Planner trust whatever the header says, so the ingress <b>must</b>
    /// overwrite it on every inbound request. An ingress that merely adds the header while passing a
    /// client-supplied one through lets any caller name themselves anyone.
    /// </remarks>
    public string ForwardedUserHeader { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets whether every caller is treated as a local operator. This exists for running the
    /// Planner on a developer machine with no proxy in front of it and is <b>never</b> correct for a
    /// reachable deployment - it hands full operator rights to anyone who can open a socket.
    /// </summary>
    public bool AllowUnauthenticatedOperators { get; set; }
}
