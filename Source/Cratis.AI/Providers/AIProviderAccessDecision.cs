// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>The outcome of checking an initiator against a provider's current selection.</summary>
/// <param name="IsAllowed">Whether dispatch may proceed.</param>
/// <param name="Reason">Why dispatch was denied, or empty when allowed.</param>
public record AIProviderAccessDecision(bool IsAllowed, string Reason);
