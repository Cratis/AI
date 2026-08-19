// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation;

sealed class SchemaEvaluationGraph
{
    readonly Dictionary<string, int> _nodeIndexes;

    SchemaEvaluationGraph(Dictionary<string, int> nodeIndexes, SchemaEvaluationNode[] nodes)
    {
        _nodeIndexes = nodeIndexes;
        Nodes = nodes;
    }

    public SchemaEvaluationNode[] Nodes { get; }

    public static bool TryCreate(IEnumerable<LoadedSchemaDocument> documents, out SchemaEvaluationGraph? graph)
    {
        graph = null;
        var loadedDocuments = documents.ToArray();
        var profiles = loadedDocuments.SelectMany(_ => _.EvaluationCostProfiles)
            .ToDictionary(_ => _.Key, _ => _.Value, StringComparer.Ordinal);
        var edges = loadedDocuments.SelectMany(_ => _.GraphEdges).ToArray();
        if (edges.Any(_ => !profiles.ContainsKey(_.Source) || !profiles.ContainsKey(_.Target))) return false;

        var incoming = profiles.Keys.ToDictionary(_ => _, _ => 0, StringComparer.Ordinal);
        var nonConsuming = edges.Where(_ => !_.Selector.ConsumesInstance)
            .GroupBy(_ => _.Source, StringComparer.Ordinal)
            .ToDictionary(_ => _.Key, _ => _.ToArray(), StringComparer.Ordinal);
        foreach (var edge in edges.Where(_ => !_.Selector.ConsumesInstance))
        {
            incoming[edge.Target]++;
        }

        var ready = new SortedSet<string>(incoming.Where(_ => _.Value == 0).Select(_ => _.Key), StringComparer.Ordinal);
        var ordered = new List<string>(profiles.Count);
        while (ready.Count > 0)
        {
            var source = ready.Min!;
            ready.Remove(source);
            ordered.Add(source);
            foreach (var edge in nonConsuming.GetValueOrDefault(source) ?? [])
            {
                incoming[edge.Target]--;
                if (incoming[edge.Target] == 0) ready.Add(edge.Target);
            }
        }

        if (ordered.Count != profiles.Count) return false;

        var indexes = ordered.Select((node, index) => new { node, index })
            .ToDictionary(_ => _.node, _ => _.index, StringComparer.Ordinal);
        var outgoing = edges.GroupBy(_ => _.Source, StringComparer.Ordinal)
            .ToDictionary(
                _ => _.Key,
                _ => _.OrderBy(edge => edge.Target, StringComparer.Ordinal)
                    .ThenBy(edge => edge.Selector.Kind)
                    .ThenBy(edge => edge.Selector.PropertyName, StringComparer.Ordinal)
                    .ThenBy(edge => edge.IsReference)
                    .Select(edge => new SchemaEvaluationEdge(indexes[edge.Target], edge.Selector, edge.IsReference))
                    .ToArray(),
                StringComparer.Ordinal);
        var nodes = ordered.Select(node => new SchemaEvaluationNode(
            profiles[node],
            outgoing.GetValueOrDefault(node) ?? [])).ToArray();
        graph = new(indexes, nodes);
        return true;
    }

    public int GetNodeIndex(LoadedSchemaResource resource) =>
        _nodeIndexes[SchemaResourceSyntax.NodeKey(resource.Document, resource.RootPointer)];
}

sealed record SchemaEvaluationNode(
    SchemaEvaluationCostProfile CostProfile,
    SchemaEvaluationEdge[] Edges);

sealed record SchemaEvaluationEdge(
    int Target,
    SchemaInstanceSelector Selector,
    bool IsReference);
