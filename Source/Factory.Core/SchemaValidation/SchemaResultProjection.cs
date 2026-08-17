// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Json.Schema;

namespace Cratis.Factory.SchemaValidation;

static class SchemaResultProjection
{
    public static ProjectedSchemaDiagnostics Project(
        EvaluationResults results,
        LoadedSchemaResource rootResource,
        IEnumerable<LoadedSchemaResource> resources,
        JsonElement instanceRoot)
    {
        var resourcesByUri = resources.ToDictionary(_ => _.ResourceUri.AbsoluteUri, StringComparer.Ordinal);
        var diagnostics = new SchemaDiagnosticCollection();
        var seen = new HashSet<SchemaDiagnostic>();
        var hadPackageErrors = false;
        Visit(results);
        if (!hadPackageErrors)
        {
            Add(new(
                SchemaDiagnosticCode.FalseSchema,
                SchemaDiagnosticSeverity.Error,
                SchemaDiagnosticStatus.Violation,
                rootResource.SchemaId,
                "#",
                "#"));
        }

        return new(diagnostics.ToReadOnly(rootResource.SchemaId), diagnostics.LimitExceeded);

        void Visit(EvaluationResults result)
        {
            if (diagnostics.LimitExceeded) return;

            if (result.Errors is not null)
            {
                foreach (var error in result.Errors.OrderBy(_ => _.Key, StringComparer.Ordinal))
                {
                    hadPackageErrors = true;
                    var location = GetOrigin(result.SchemaLocation, resourcesByUri);
                    var origin = location?.Origin ?? new(rootResource, string.Empty, false, false);
                    SchemaOrigin? referencedFalseOrigin = null;
                    var isReferencedFalseSchema = error.Key.Length == 0 &&
                                                  TryGetReferencedFalseOrigin(location, out referencedFalseOrigin);
                    if (isReferencedFalseSchema)
                    {
                        origin = referencedFalseOrigin!;
                    }
                    var schemaLocation = GetSchemaLocation(origin.Pointer, error.Key);
                    if (isReferencedFalseSchema)
                    {
                        schemaLocation = origin.Pointer;
                    }

                    Add(new(
                        isReferencedFalseSchema ? SchemaDiagnosticCode.FalseSchema : ToDiagnosticCode(error.Key),
                        SchemaDiagnosticSeverity.Error,
                        SchemaDiagnosticStatus.Violation,
                        origin.Resource.SchemaId,
                        SafeSchemaLocation.FromInstancePointer(result.InstanceLocation.ToString(), instanceRoot),
                        SafeSchemaLocation.FromSchemaPointer(schemaLocation, origin.Resource.Source)));
                    if (diagnostics.LimitExceeded) return;
                }
            }

            foreach (var detail in (result.Details ?? []).OrderBy(_ => _.InstanceLocation.ToString(), StringComparer.Ordinal)
                         .ThenBy(_ => _.SchemaLocation.AbsoluteUri, StringComparer.Ordinal))
            {
                Visit(detail);
                if (diagnostics.LimitExceeded) return;
            }
        }

        void Add(SchemaDiagnostic diagnostic)
        {
            if (seen.Add(diagnostic))
            {
                diagnostics.Add(
                    diagnostic.Code,
                    diagnostic.Status,
                    diagnostic.SchemaId,
                    diagnostic.InstanceLocation,
                    diagnostic.KeywordLocation);
            }
        }
    }

    static SchemaDiagnosticCode ToDiagnosticCode(string keyword) => keyword switch
    {
        "additionalProperties" => SchemaDiagnosticCode.AdditionalProperties,
        "allOf" => SchemaDiagnosticCode.AllOf,
        "anyOf" => SchemaDiagnosticCode.AnyOf,
        "const" => SchemaDiagnosticCode.Const,
        "contains" => SchemaDiagnosticCode.Contains,
        "enum" => SchemaDiagnosticCode.Enum,
        "format" => SchemaDiagnosticCode.Format,
        "items" => SchemaDiagnosticCode.Items,
        "maximum" => SchemaDiagnosticCode.Maximum,
        "maxItems" => SchemaDiagnosticCode.MaxItems,
        "maxLength" => SchemaDiagnosticCode.MaxLength,
        "minimum" => SchemaDiagnosticCode.Minimum,
        "minItems" => SchemaDiagnosticCode.MinItems,
        "minLength" => SchemaDiagnosticCode.MinLength,
        "not" => SchemaDiagnosticCode.Not,
        "oneOf" => SchemaDiagnosticCode.OneOf,
        "pattern" => SchemaDiagnosticCode.Pattern,
        "required" => SchemaDiagnosticCode.Required,
        "type" => SchemaDiagnosticCode.Type,
        "unevaluatedProperties" => SchemaDiagnosticCode.UnevaluatedProperties,
        "uniqueItems" => SchemaDiagnosticCode.UniqueItems,
        _ => SchemaDiagnosticCode.ValidationFailed
    };

    static string GetSchemaLocation(string originPointer, string keyword)
    {
        if (keyword.Length == 0) return SchemaResourceSyntax.CombinePointer(originPointer, string.Empty);

        if (originPointer.EndsWith("/contains", StringComparison.Ordinal))
        {
            return SchemaResourceSyntax.CombinePointer($"{originPointer}/items", keyword);
        }

        var conditionalSegment = originPointer.EndsWith("/if", StringComparison.Ordinal) ||
                                 originPointer.EndsWith("/then", StringComparison.Ordinal) ||
                                 originPointer.EndsWith("/else", StringComparison.Ordinal);
        var propertiesIndex = originPointer.LastIndexOf("/properties/", StringComparison.Ordinal);
        if (!conditionalSegment || propertiesIndex < 0)
        {
            return SchemaResourceSyntax.CombinePointer(originPointer, keyword);
        }

        var propertyStart = propertiesIndex + "/properties/".Length;
        var propertyEnd = originPointer.IndexOf('/', propertyStart);
        if (propertyEnd < 0) return SchemaResourceSyntax.CombinePointer(originPointer, keyword);

        var propertySegment = originPointer[propertyStart..propertyEnd];
        return SchemaResourceSyntax.CombinePointer($"{originPointer}/{propertySegment}", keyword);
    }

    static bool TryGetReferencedFalseOrigin(SchemaLocationOrigin? location, out SchemaOrigin? origin)
    {
        if (location is null)
        {
            origin = null;
            return false;
        }

        origin = location.Origin;
        if (origin is { IsReferenceTarget: true, IsFalseSchema: true }) return true;

        var keywordPointer = SchemaResourceSyntax.CombinePointer(location.ViewPointer, "$ref");
        if (location.ViewResource.PackageView is null ||
            !location.ViewResource.PackageView.References.TryGetValue(keywordPointer, out var reference) ||
            reference.Edge.TargetResource.PackageView is null ||
            !reference.Edge.TargetResource.PackageView.Origins.TryGetValue(reference.TargetPointer, out var targetOrigin) ||
            targetOrigin is not { IsReferenceTarget: true, IsFalseSchema: true })
        {
            return false;
        }

        origin = targetOrigin;
        return true;
    }

    static SchemaLocationOrigin? GetOrigin(
        Uri schemaLocation,
        Dictionary<string, LoadedSchemaResource> resources)
    {
        if (!SchemaResourceSyntax.TryReadSchemaLocation(schemaLocation, out var resourceId, out var pointer) ||
            !resources.TryGetValue(resourceId!, out var viewResource) ||
            viewResource.PackageView is null)
        {
            return null;
        }

        var schemaPointer = pointer!;
        while (true)
        {
            if (viewResource.PackageView.Origins.TryGetValue(schemaPointer, out var origin))
            {
                return new(viewResource, schemaPointer, origin);
            }

            var separator = schemaPointer.LastIndexOf('/');
            if (separator < 0) return null;
            schemaPointer = schemaPointer[..separator];
        }
    }
}

sealed record SchemaLocationOrigin(
    LoadedSchemaResource ViewResource,
    string ViewPointer,
    SchemaOrigin Origin);

sealed record ProjectedSchemaDiagnostics(
    IReadOnlyList<SchemaDiagnostic> Diagnostics,
    bool LimitExceeded);
