// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Copilot;

/// <summary>
/// Configuration for signing a Copilot provider in, bound from <c>Direct:Copilot</c>.
/// </summary>
/// <remarks>
/// GitHub's device flow authenticates against an <b>OAuth app</b>, which is not the same thing as
/// the GitHub App <c>GitHubOptions</c> configures: an App authenticates as an installation on
/// repositories, while a Copilot session has to act as a <i>user</i> who holds a Copilot seat. So
/// this is its own client id rather than a reuse of the App's, and a deployment that has not
/// registered one is told to register one instead of being handed a flow that cannot complete.
/// </remarks>
public class CopilotOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Direct:Copilot";

    /// <summary>
    /// Gets or sets the OAuth app client id the device flow authenticates against. Not a secret -
    /// a client id identifies the application, and it is the user's own authorization that grants
    /// anything. Empty until a deployment registers an OAuth app of its own.
    /// </summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the scopes requested for the token.
    /// </summary>
    /// <remarks>
    /// <c>read:user</c> is what identifies the account whose Copilot entitlement the CLI then uses;
    /// Copilot access itself follows the user's seat rather than a scope that can be asked for here.
    /// Left configurable because an organization whose policy requires a narrower or wider set - or
    /// whose enterprise adds one - should not need a Direct release to change it.
    /// </remarks>
    public string Scope { get; set; } = "read:user";
}
