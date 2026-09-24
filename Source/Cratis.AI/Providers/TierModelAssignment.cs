// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers;

/// <summary>
/// Derives a tier-to-model mapping from the catalog a provider actually published - the only way a
/// tier ever arrives at a model name nobody configured.
/// </summary>
/// <remarks>
/// <para>
/// This replaces the hardcoded per-vendor default catalog this package used to carry. That catalog
/// was a list of model names somebody believed a vendor offered, a belief with an expiry date:
/// it named models that had been renamed, and at least one that never existed at all, and a tier
/// resolving to a name the vendor does not serve is a dispatch that silently falls back to whatever
/// the harness defaults to. Every name here comes out of the vendor's own model listing.
/// </para>
/// <para>
/// The ladder is inferred from the names rather than from a table: vendors name the small end of
/// their range (haiku, mini, nano, flash, lite) and the large end (opus, pro, max, ultra) with
/// remarkably stable words, and everything else is the everyday middle. Within a rung the highest
/// version wins, read as the numbers in the identifier - <c>claude-opus-4-5-20251101</c> sorts above
/// <c>claude-3-opus-20240229</c> because 4 beats 3, and a dated suffix breaks ties within a version.
/// An inference, and deliberately a conservative one: it only ever picks a model the provider
/// published, and an operator's own mapping always wins over it.
/// </para>
/// <para>
/// There are four tiers and there used to be three rungs, so Premier was handed the same model as
/// Powerful and the most capable tier meant nothing. A vendor that has a model above its
/// flagship names it as its own family - Anthropic publishes <c>claude-fable-5-1</c> alongside
/// <c>claude-opus-5</c> - and a family this does not recognize falls into the everyday middle, which
/// is how a frontier model ended up on Balanced and the flagship on both top tiers. The frontier
/// markers are therefore learned from catalogs that were actually read, and the list grows the same
/// way: by a vendor publishing one, never by guessing what it might call it next.
/// </para>
/// </remarks>
public static class TierModelAssignment
{
    static readonly string[] _modestMarkers = ["haiku", "nano", "mini", "flash", "lite", "spark", "small", "tiny", "air"];
    static readonly string[] _foremostMarkers = ["opus", "ultra", "heavy", "-pro", "-max"];
    static readonly string[] _frontierMarkers = ["fable"];

    /// <summary>
    /// Derives the mapping a catalog supports.
    /// </summary>
    /// <param name="models">The models the provider published.</param>
    /// <returns>The mapping, or <see cref="TierModels.NotSet"/> when the catalog names nothing usable.</returns>
    public static TierModels From(IEnumerable<ModelName>? models)
    {
        var ranked = (models ?? [])
            .Where(model => AIModelCapabilities.For(model).Contains(AIModelCapability.Conversational))
            .Select((model, order) => new Candidate(model, RankOf(model), VersionOf(model), order))
            .ToArray();

        if (ranked.Length == 0)
        {
            return TierModels.NotSet;
        }

        return new(
            Pick(ranked, Rung.Modest),
            Pick(ranked, Rung.Everyday),
            Pick(ranked, Rung.Foremost),
            Pick(ranked, Rung.Frontier));
    }

    static ModelName Pick(IReadOnlyList<Candidate> ranked, int rung)
    {
        foreach (var preferred in PreferenceFor(rung))
        {
            var best = ranked
                .Where(candidate => candidate.Rung == preferred)
                .OrderByDescending(candidate => candidate.Version, VersionOrder.Instance)
                .ThenBy(candidate => candidate.Order)
                .FirstOrDefault();

            if (best is not null)
            {
                return best.Model;
            }
        }

        return ModelName.NotSet;
    }

    // A rung with nothing on it borrows from the neighbour that says the least about capability in
    // the wrong direction: the modest tier would rather have the everyday model than the flagship,
    // and the top tiers would rather have the everyday model than the cheap one. A vendor with no
    // model above its flagship - which is most of them - puts the flagship on Premier, so the tier
    // still resolves to something rather than to nothing.
    static int[] PreferenceFor(int rung) => rung switch
    {
        Rung.Modest => [Rung.Modest, Rung.Everyday, Rung.Foremost, Rung.Frontier],
        Rung.Everyday => [Rung.Everyday, Rung.Foremost, Rung.Frontier, Rung.Modest],
        Rung.Foremost => [Rung.Foremost, Rung.Frontier, Rung.Everyday, Rung.Modest],
        _ => [Rung.Frontier, Rung.Foremost, Rung.Everyday, Rung.Modest],
    };

    static int RankOf(ModelName model)
    {
        var identifier = model.Value.ToLowerInvariant();
        if (_modestMarkers.Any(marker => identifier.Contains(marker, StringComparison.Ordinal))) return Rung.Modest;
        if (_frontierMarkers.Any(marker => identifier.Contains(marker, StringComparison.Ordinal))) return Rung.Frontier;
        if (_foremostMarkers.Any(marker => identifier.Contains(marker, StringComparison.Ordinal))) return Rung.Foremost;

        return Rung.Everyday;
    }

    static List<long> VersionOf(ModelName model)
    {
        var numbers = new List<long>();
        var current = string.Empty;
        foreach (var character in model.Value)
        {
            if (char.IsAsciiDigit(character))
            {
                current += character;
                continue;
            }

            if (current.Length > 0 && long.TryParse(current, out var parsed)) numbers.Add(parsed);
            current = string.Empty;
        }

        if (current.Length > 0 && long.TryParse(current, out var trailing)) numbers.Add(trailing);

        return numbers;
    }

    static class Rung
    {
        public const int Modest = 0;
        public const int Everyday = 1;
        public const int Foremost = 2;
        public const int Frontier = 3;
    }

    sealed record Candidate(ModelName Model, int Rung, IReadOnlyList<long> Version, int Order);

    sealed class VersionOrder : IComparer<IReadOnlyList<long>>
    {
        public static readonly VersionOrder Instance = new();

        public int Compare(IReadOnlyList<long>? x, IReadOnlyList<long>? y)
        {
            x ??= [];
            y ??= [];
            for (var index = 0; index < Math.Max(x.Count, y.Count); index++)
            {
                var left = index < x.Count ? x[index] : 0;
                var right = index < y.Count ? y[index] : 0;
                if (left != right) return left.CompareTo(right);
            }

            return 0;
        }
    }
}
