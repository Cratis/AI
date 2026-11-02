// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Proxies.for_the_package_barrel;

/// <summary>
/// The package exports only its root entry, so a generated folder the hand-maintained barrel forgets
/// is unreachable for every consumer. The proxy drift gate checks ./generated, not the barrel.
/// </summary>
public class when_reading_the_generated_folders : Specification
{
    string[] _folders;
    HashSet<string> _exported;

    void Because()
    {
        _folders = GeneratedProxies.Paths
            .Where(_ => _.StartsWith("generated/", StringComparison.Ordinal) && _.EndsWith("/index.ts", StringComparison.Ordinal))
            .Select(_ => _[..^"/index.ts".Length])
            .Order(StringComparer.Ordinal)
            .ToArray();
        _exported = GeneratedProxies.Read("index.ts")
            .Split('\n')
            .Select(_ => _.Trim())
            .Where(_ => _.StartsWith("export *", StringComparison.Ordinal))
            .Select(_ => _.Split(" from './", 2))
            .Where(_ => _.Length == 2)
            .Select(_ => _[1].TrimEnd(';', '\''))
            .ToHashSet(StringComparer.Ordinal);
    }

    [Fact] void should_find_the_generated_folders() => _folders.ShouldNotBeEmpty();

    [Fact] void should_export_every_generated_folder_from_the_barrel() => _folders.Where(_ => !_exported.Contains(_)).ShouldBeEmpty();
}
