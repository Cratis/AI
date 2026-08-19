// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Runtime.InteropServices;
using System.Text.Json;

namespace Cratis.Factory.SchemaValidation;

[StructLayout(LayoutKind.Auto)]
readonly record struct SchemaValidationWorkMeasurement(int InstanceNodes, long EvaluationWorkUnits)
{
    public bool ExceedsValidationLimit =>
        InstanceNodes > SchemaValidationLimits.MaximumInstanceNodes ||
        EvaluationWorkUnits > SchemaValidationLimits.MaximumEvaluationWorkUnits;

    public bool ExceedsDiagnosticLimit =>
        InstanceNodes > SchemaValidationLimits.MaximumDiagnosticInstanceNodes ||
        EvaluationWorkUnits > SchemaValidationLimits.MaximumDiagnosticWorkUnits;
}

static class SchemaValidationWork
{
    public static SchemaValidationWorkMeasurement Measure(
        JsonElement instance,
        SchemaEvaluationGraph schemaGraph,
        int rootSchemaNode)
    {
        var instanceGraph = SchemaInstanceGraph.Create(instance);
        if (instanceGraph.NodeLimitExceeded)
        {
            return new(instanceGraph.Nodes.Length, 0);
        }

        var pending = new SortedDictionary<int, long>?[instanceGraph.Nodes.Length];
        AddState(0, rootSchemaNode, 1);
        long work = 0;
        for (var instanceIndex = 0; instanceIndex < instanceGraph.Nodes.Length; instanceIndex++)
        {
            var states = pending[instanceIndex];
            if (states is null) continue;

            long priorSameInstanceResults = 0;
            while (states.Count > 0)
            {
                using var enumerator = states.GetEnumerator();
                _ = enumerator.MoveNext();
                var schemaIndex = enumerator.Current.Key;
                var multiplicity = enumerator.Current.Value;
                states.Remove(schemaIndex);
                var schemaNode = schemaGraph.Nodes[schemaIndex];
                var instanceNode = instanceGraph.Nodes[instanceIndex];
                var stateCost = SchemaValidationCostModel.MeasureState(
                    schemaNode.CostProfile,
                    instanceNode,
                    instanceGraph.Nodes,
                    priorSameInstanceResults);
                work = SchemaValidationCostModel.SaturatingAdd(
                    work,
                    SchemaValidationCostModel.SaturatingMultiply(multiplicity, stateCost));
                if (work > SchemaValidationLimits.MaximumEvaluationWorkUnits)
                {
                    return new(instanceGraph.Nodes.Length, work);
                }

                priorSameInstanceResults = SchemaValidationCostModel.SaturatingAdd(
                    priorSameInstanceResults,
                    multiplicity);
                foreach (var edge in schemaNode.Edges)
                {
                    AddSelectedStates(edge, instanceIndex, multiplicity);
                }
            }

            pending[instanceIndex] = null;
        }

        return new(instanceGraph.Nodes.Length, work);

        void AddSelectedStates(SchemaEvaluationEdge edge, int sourceInstance, long multiplicity)
        {
            var source = instanceGraph.Nodes[sourceInstance];
            switch (edge.Selector.Kind)
            {
                case SchemaInstanceSelectorKind.SameInstance:
                    AddState(sourceInstance, edge.Target, multiplicity);
                    break;
                case SchemaInstanceSelectorKind.NamedProperty:
                    foreach (var child in source.Children.Where(child =>
                                 string.Equals(
                                     instanceGraph.Nodes[child].PropertyName,
                                     edge.Selector.PropertyName,
                                     StringComparison.Ordinal)))
                    {
                        AddState(child, edge.Target, multiplicity);
                    }
                    break;
                case SchemaInstanceSelectorKind.EachArrayItem when source.Value.ValueKind is JsonValueKind.Array:
                    foreach (var child in source.Children)
                    {
                        AddState(child, edge.Target, multiplicity);
                    }
                    break;
                case SchemaInstanceSelectorKind.AdditionalObjectMember when source.Value.ValueKind is JsonValueKind.Object:
                    var exclusions = edge.Selector.ExcludedPropertyNames ?? [];
                    foreach (var child in source.Children.Where(child =>
                                 Array.BinarySearch(
                                     exclusions,
                                     instanceGraph.Nodes[child].PropertyName,
                                     StringComparer.Ordinal) < 0))
                    {
                        AddState(child, edge.Target, multiplicity);
                    }
                    break;
                case SchemaInstanceSelectorKind.EveryObjectValue when source.Value.ValueKind is JsonValueKind.Object:
                    foreach (var child in source.Children)
                    {
                        AddState(child, edge.Target, multiplicity);
                    }
                    break;
            }
        }

        void AddState(int instanceIndex, int schemaIndex, long multiplicity)
        {
            var states = pending[instanceIndex] ??= [];
            states[schemaIndex] = states.TryGetValue(schemaIndex, out var existing)
                ? SchemaValidationCostModel.SaturatingAdd(existing, multiplicity)
                : multiplicity;
        }
    }
}
