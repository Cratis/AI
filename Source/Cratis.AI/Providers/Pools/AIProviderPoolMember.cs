// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// One provider belonging to a pool.
/// </summary>
/// <param name="ProviderId">The identity of the member provider.</param>
/// <remarks>
/// <b>Intentionally minimal for now</b>, the same way <see cref="ConfiguredAIProvider"/> is (see its
/// own remarks) - Direct's donor equivalent is a Chronicle read model projected from pool CRUD
/// events (create/rename/remove, add/remove provider) that do not exist in the package yet (plan
/// Section 5.2 step 5). This record carries only what <see cref="PoolMemberSelector"/> needs.
/// </remarks>
public record AIProviderPoolMember(AIProviderId ProviderId);
