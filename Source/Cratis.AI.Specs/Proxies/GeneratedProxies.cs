// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Proxies;

/// <summary>
/// Reads the committed proxy package files the specs project embeds, keyed by their path in the package.
/// </summary>
public static class GeneratedProxies
{
    const string Prefix = "Proxies/";

    /// <summary>
    /// Gets the package-relative paths of every embedded proxy file, with forward slashes.
    /// </summary>
    public static IEnumerable<string> Paths =>
        typeof(GeneratedProxies).Assembly.GetManifestResourceNames()
            .Where(_ => _.StartsWith(Prefix, StringComparison.Ordinal))
            .Select(_ => _[Prefix.Length..].Replace('\\', '/'));

    /// <summary>
    /// Reads one embedded proxy file.
    /// </summary>
    /// <param name="path">The package-relative path, for example <c>index.ts</c>.</param>
    /// <returns>The file's contents.</returns>
    public static string Read(string path)
    {
        var name = typeof(GeneratedProxies).Assembly.GetManifestResourceNames()
            .Single(_ => _.StartsWith(Prefix, StringComparison.Ordinal) && _[Prefix.Length..].Replace('\\', '/') == path);
        using var stream = typeof(GeneratedProxies).Assembly.GetManifestResourceStream(name)!;
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
