// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Serialization;

namespace Cratis.Factory.Conformance;

static class CanonicalJsonVectorManifestLoader
{
    static readonly JsonSerializerOptions _serializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    public static string ManifestPath => Path.Combine(AppContext.BaseDirectory, "Fixtures", "canonical-json-vectors.json");

    public static CanonicalJsonVectorManifest Load() => Load(File.ReadAllBytes(ManifestPath));

    public static CanonicalJsonVectorManifest Load(ReadOnlySpan<byte> utf8)
    {
        var manifest = JsonSerializer.Deserialize<CanonicalJsonVectorManifest>(utf8, _serializerOptions) ??
                       throw new InvalidDataException("The canonical JSON vector manifest is empty.");
        Validate(manifest);
        return manifest;
    }

    public static void Validate(CanonicalJsonVectorManifest manifest) => CanonicalJsonVectorManifestValidator.Validate(manifest);
}
