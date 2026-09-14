// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Configuration.for_CratisAIServiceCollectionExtensions.when_ensuring_loaded;

/// <summary>
/// The narrow guarantee this project can prove in-process: once <c>Cratis.AI</c> is loaded (this
/// project references it, so it always is by the time a test runs), the sentinel is visible in the
/// type universe and <see cref="CratisAIServiceCollectionExtensions.EnsureLoaded"/> does not throw.
/// </summary>
/// <remarks>
/// This does <em>not</em> prove the ordering guarantee against a host that references
/// <c>Cratis.AI</c> as a package rather than a project - that is a materially different code path
/// (plan Section 12.2 step 4) and needs an integration spec host set up against a local NuGet feed,
/// which is future work once the package first packs.
/// </remarks>
public class and_the_assembly_is_referenced : Specification
{
    Exception? _exception;

    void Because() => _exception = Catch.Exception(CratisAIServiceCollectionExtensions.EnsureLoaded);

    [Fact] void should_not_throw() => _exception.ShouldBeNull();
}
