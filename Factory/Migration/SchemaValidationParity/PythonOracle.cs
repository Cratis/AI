// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.SchemaValidationParity;

sealed class PythonOracle : IDisposable
{
    static readonly TimeSpan _responseTimeout = TimeSpan.FromSeconds(120);
    static readonly TimeSpan _exitTimeout = TimeSpan.FromSeconds(10);
    static readonly HashSet<string> _loadStatuses = new(["Loaded", "Rejected"], StringComparer.Ordinal);
    static readonly HashSet<string> _validationStatuses = new(["Valid", "Invalid", "Rejected", "DiagnosticLimitExceeded", "EvaluationLimitExceeded"], StringComparer.Ordinal);
    static readonly HashSet<string> _diagnosticStatuses = new(["Violation", "Rejected", "LimitExceeded"], StringComparer.Ordinal);
    static readonly HashSet<string> _diagnosticCodes = new(Enum.GetNames<SchemaDiagnosticCode>(), StringComparer.Ordinal);
    static readonly HashSet<string> _keywordSegments = new(
        ["$anchor", "$comment", "$defs", "$id", "$ref", "$schema", "$vocabulary", "additionalProperties", "allOf", "anyOf", "const", "contains", "description", "else", "enum", "format", "if", "items", "maxItems", "maxLength", "maximum", "minItems", "minLength", "minimum", "not", "oneOf", "pattern", "properties", "required", "then", "title", "type", "unevaluatedProperties", "uniqueItems"],
        StringComparer.Ordinal);
    readonly Process _process;

    public PythonOracle(string pythonExecutable, string repositoryRoot)
    {
        var adapter = Path.Combine(repositoryRoot, "Factory", "Migration", "SchemaValidationParity", "oracle_adapter.py");
        var boundedJson = Path.Combine(repositoryRoot, "Factory", "Migration", "CanonicalJsonParity", "bounded_json.py");
        var canonicalJson = Path.Combine(repositoryRoot, "Factory", "scripts", "canonical_json.py");
        if (!File.Exists(adapter) || !File.Exists(boundedJson) || !File.Exists(canonicalJson))
        {
            throw new InvalidMigrationEnvironment();
        }

        var start = new ProcessStartInfo
        {
            FileName = pythonExecutable,
            WorkingDirectory = repositoryRoot,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        start.ArgumentList.Add("-I");
        start.ArgumentList.Add("-B");
        start.ArgumentList.Add(adapter);
        start.ArgumentList.Add("--bounded-json");
        start.ArgumentList.Add(boundedJson);
        start.ArgumentList.Add("--canonical-json");
        start.ArgumentList.Add(canonicalJson);

        _process = new() { StartInfo = start };
        _process.ErrorDataReceived += (_, _) => { };
        if (!_process.Start())
        {
            throw new InvalidMigrationEnvironment();
        }
        _process.BeginErrorReadLine();
    }

    public OracleResponse Evaluate(
        IEnumerable<OracleSchemaDocument> schemaDocuments,
        string? rootSchemaId,
        byte[]? instance,
        int repeatCount,
        int parallelCount)
    {
        if (_process.HasExited)
        {
            throw new InvalidMigrationEnvironment();
        }

        var request = new OracleRequest(
            "1",
            [.. schemaDocuments],
            rootSchemaId,
            instance is null ? null : Convert.ToBase64String(instance),
            repeatCount,
            parallelCount);
        _process.StandardInput.WriteLine(JsonSerializer.Serialize(request, ParityJson.Options));
        _process.StandardInput.Flush();

        string? response;
        try
        {
            response = _process.StandardOutput.ReadLineAsync().WaitAsync(_responseTimeout).GetAwaiter().GetResult();
        }
        catch (TimeoutException)
        {
            throw new InvalidMigrationEnvironment();
        }

        if (response is null)
        {
            throw new InvalidMigrationEnvironment();
        }
        StrictOracleShape.Validate(response);
        var parsed = JsonSerializer.Deserialize<OracleResponse>(response, ParityJson.Options) ?? throw new InvalidMigrationEnvironment();
        return Validate(parsed);
    }

    public void Dispose()
    {
        try
        {
            _process.StandardInput.Close();
            if (!_process.WaitForExit(_exitTimeout))
            {
                _process.Kill(true);
                _process.WaitForExit();
                throw new InvalidMigrationEnvironment();
            }
            if (_process.ExitCode != 0)
            {
                throw new InvalidMigrationEnvironment();
            }
        }
        finally
        {
            _process.Dispose();
        }
    }

    static OracleResponse Validate(OracleResponse response)
    {
        if (!string.Equals(response.ProtocolVersion, "1", StringComparison.Ordinal) ||
            response.LoadStatus is null ||
            !_loadStatuses.Contains(response.LoadStatus) ||
            (response.ValidationStatus is not null && !_validationStatuses.Contains(response.ValidationStatus)) ||
            !IsComplete(response.SchemaSet) ||
            !IsComplete(response.Closure) ||
            response.Diagnostics is null ||
            response.RepeatDeterministic is null ||
            response.ParallelDeterministic is null ||
            response.Diagnostics.Length > SchemaValidationLimits.MaximumDiagnostics ||
            response.Diagnostics.Any(diagnostic => !IsValid(diagnostic)) ||
            !IsStrictlyOrdered(response.Diagnostics, CompareDiagnostics))
        {
            throw new InvalidMigrationEnvironment();
        }

        var expectsSet = string.Equals(response.LoadStatus, "Loaded", StringComparison.Ordinal);
        if (expectsSet != (response.SchemaSet is not null) ||
            (response.ValidationStatus is null && response.Closure is not null) ||
            (response.ValidationStatus is not null &&
             !string.Equals(response.ValidationStatus, "Rejected", StringComparison.Ordinal) &&
             response.Closure is null) ||
            !HasConsistentEnvelope(response))
        {
            throw new InvalidMigrationEnvironment();
        }

        return response;
    }

    static bool IsComplete(OracleSchemaSet? set)
    {
        if (set is null) return true;
        if (!IsSha256(set.Identity) ||
            set.Documents is null ||
            set.Resources is null ||
            set.ResourceCount != set.Resources.Length ||
            set.Documents.Length > SchemaValidationLimits.MaximumDocuments ||
            set.Resources.Length > SchemaValidationLimits.MaximumResources ||
            set.AnchorCount is not (>= 0 and <= SchemaValidationLimits.MaximumAnchors) ||
            set.ReferenceCount is not (>= 0 and <= SchemaValidationLimits.MaximumReferenceEdges) ||
            !set.Documents.All(IsValid) ||
            !set.Resources.All(IsValid) ||
            !IsStrictlyOrdered(set.Documents, (left, right) => string.CompareOrdinal(left.SchemaId, right.SchemaId)) ||
            !IsStrictlyOrdered(set.Resources, (left, right) => string.CompareOrdinal(left.SchemaId, right.SchemaId)) ||
            set.Documents.Sum(_ => _.ReferenceCount) != set.ReferenceCount ||
            set.Resources.Sum(_ => _.ReferenceCount) != set.ReferenceCount)
        {
            return false;
        }

        var documents = set.Documents.ToDictionary(_ => _.SchemaId!, StringComparer.Ordinal);
        return set.Resources.All(resource =>
            documents.TryGetValue(resource.DocumentId!, out var document) &&
            string.Equals(resource.ContentHash, document.ContentHash, StringComparison.Ordinal));
    }

    static bool IsComplete(OracleSchemaClosure? closure)
    {
        if (closure is null) return true;
        return IsSafeIdentifier(closure.RootSchemaId) &&
               IsSha256(closure.Identity) &&
               closure.Members is not null &&
               closure.ResourceCount is >= 1 and <= SchemaValidationLimits.MaximumResources &&
               closure.ResourceCount >= closure.Members.Length &&
               closure.AnchorCount is >= 0 and <= SchemaValidationLimits.MaximumAnchors &&
               closure.ReferenceCount is >= 0 and <= SchemaValidationLimits.MaximumReferenceEdges &&
               closure.Members.All(IsValid) &&
               IsStrictlyOrdered(closure.Members, (left, right) => string.CompareOrdinal(left.SchemaId, right.SchemaId)) &&
               closure.Members.Sum(_ => _.ReferenceCount) == closure.ReferenceCount;
    }

    static bool HasConsistentEnvelope(OracleResponse response)
    {
        if (string.Equals(response.LoadStatus, "Rejected", StringComparison.Ordinal))
        {
            return response.SchemaSet is null &&
                   response.ValidationStatus is null &&
                   response.Closure is null &&
                   response.Diagnostics is { Length: > 0 } &&
                   response.Diagnostics.All(_ =>
                       string.Equals(_.Status, "Rejected", StringComparison.Ordinal) ||
                       string.Equals(_.Status, "LimitExceeded", StringComparison.Ordinal));
        }

        if (response.ValidationStatus is null)
        {
            return response.Diagnostics is { Length: 0 } && response.Closure is null;
        }

        return response.ValidationStatus switch
        {
            "Valid" => response.Diagnostics is { Length: 0 } && response.Closure is not null,
            "Invalid" => response.Diagnostics is { Length: > 0 } &&
                         response.Diagnostics.All(_ => string.Equals(_.Status, "Violation", StringComparison.Ordinal)) &&
                         response.Closure is not null,
            "DiagnosticLimitExceeded" =>
                (response.Diagnostics is { Length: 1 } &&
                 string.Equals(response.Diagnostics[0].Code, nameof(SchemaDiagnosticCode.DiagnosticLimitExceeded), StringComparison.Ordinal) &&
                 string.Equals(response.Diagnostics[0].Status, "LimitExceeded", StringComparison.Ordinal) &&
                 response.Closure is not null) ||
                (response.Diagnostics is { Length: SchemaValidationLimits.MaximumDiagnostics } &&
                 response.Diagnostics.Count(_ =>
                     string.Equals(_.Code, nameof(SchemaDiagnosticCode.DiagnosticLimitExceeded), StringComparison.Ordinal) &&
                     string.Equals(_.Status, "LimitExceeded", StringComparison.Ordinal)) == 1 &&
                 response.Closure is not null),
            "EvaluationLimitExceeded" => response.Diagnostics is { Length: 1 } &&
                                         (string.Equals(response.Diagnostics[0].Code, nameof(SchemaDiagnosticCode.InstanceNodeLimitExceeded), StringComparison.Ordinal) ||
                                          string.Equals(response.Diagnostics[0].Code, nameof(SchemaDiagnosticCode.EvaluationWorkLimitExceeded), StringComparison.Ordinal)) &&
                                         string.Equals(response.Diagnostics[0].Status, "LimitExceeded", StringComparison.Ordinal) &&
                                         response.Closure is not null,
            "Rejected" => response.Diagnostics is { Length: > 0 } &&
                          response.Diagnostics.All(_ =>
                              string.Equals(_.Status, "Rejected", StringComparison.Ordinal) ||
                              string.Equals(_.Status, "LimitExceeded", StringComparison.Ordinal)),
            _ => false
        };
    }

    static bool IsValid(OracleSchemaMember member) =>
        IsSafeIdentifier(member.SchemaId) &&
        IsSha256(member.ContentHash) &&
        member.ReferenceCount is >= 0 and <= SchemaValidationLimits.MaximumReferenceEdges;

    static bool IsValid(OracleSchemaResource resource) =>
        IsSafeIdentifier(resource.SchemaId) &&
        IsSafeIdentifier(resource.DocumentId) &&
        IsSha256(resource.ContentHash) &&
        resource.ReferenceCount is >= 0 and <= SchemaValidationLimits.MaximumReferenceEdges;

    static bool IsValid(OracleDiagnostic diagnostic)
    {
        if (diagnostic.Code is null ||
            !_diagnosticCodes.Contains(diagnostic.Code) ||
            diagnostic.Status is null ||
            !_diagnosticStatuses.Contains(diagnostic.Status) ||
            !string.Equals(diagnostic.Severity, nameof(SchemaDiagnosticSeverity.Error), StringComparison.Ordinal) ||
            !IsSafeLocation(diagnostic.InstanceLocation, false) ||
            !IsSafeLocation(diagnostic.KeywordLocation, true))
        {
            return false;
        }

        if (diagnostic.SchemaId is not null) return IsSafeIdentifier(diagnostic.SchemaId);
        return Enum.TryParse<SchemaDiagnosticCode>(diagnostic.Code, out var code) &&
               (code <= SchemaDiagnosticCode.SchemaNotFound ||
                code is SchemaDiagnosticCode.NoSchemaDocuments or
                    SchemaDiagnosticCode.SchemaNodeLimitExceeded or
                    SchemaDiagnosticCode.ReferenceDepthLimitExceeded or
                    SchemaDiagnosticCode.SchemaDocumentEnumerationFailed);
    }

    static int CompareDiagnostics(OracleDiagnostic left, OracleDiagnostic right)
    {
        var comparison = string.CompareOrdinal(left.SchemaId, right.SchemaId);
        if (comparison != 0) return comparison;
        comparison = string.CompareOrdinal(left.InstanceLocation, right.InstanceLocation);
        if (comparison != 0) return comparison;
        comparison = string.CompareOrdinal(left.KeywordLocation, right.KeywordLocation);
        if (comparison != 0) return comparison;
        _ = Enum.TryParse<SchemaDiagnosticCode>(left.Code, out var leftCode);
        _ = Enum.TryParse<SchemaDiagnosticCode>(right.Code, out var rightCode);
        comparison = leftCode.CompareTo(rightCode);
        if (comparison != 0) return comparison;
        _ = Enum.TryParse<SchemaDiagnosticStatus>(left.Status, out var leftStatus);
        _ = Enum.TryParse<SchemaDiagnosticStatus>(right.Status, out var rightStatus);
        comparison = leftStatus.CompareTo(rightStatus);
        return comparison != 0 ? comparison : string.CompareOrdinal(left.Severity, right.Severity);
    }

    static bool IsSafeIdentifier(string? value)
    {
        if (string.IsNullOrEmpty(value) ||
            value.EnumerateRunes().Count() > SchemaValidationLimits.MaximumSchemaIdScalars ||
            value.Any(character => char.IsControl(character) || char.IsWhiteSpace(character) || character > '\u007e') ||
            !Uri.TryCreate(value, UriKind.Absolute, out var identifier))
        {
            return false;
        }
        return string.Equals(identifier.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
               string.IsNullOrEmpty(identifier.Fragment) &&
               string.IsNullOrEmpty(identifier.Query) &&
               string.IsNullOrEmpty(identifier.UserInfo);
    }

    static bool IsSha256(string? value)
    {
        if (value is not { Length: 71 } || !value.StartsWith("sha256:", StringComparison.Ordinal)) return false;
        foreach (var character in value.AsSpan(7))
        {
            if (character is not (>= '0' and <= '9') and not (>= 'a' and <= 'f')) return false;
        }
        return true;
    }

    static bool IsSafeLocation(string? value, bool allowKeywords)
    {
        if (string.Equals(value, "#", StringComparison.Ordinal)) return true;
        if (value?.StartsWith("#/", StringComparison.Ordinal) != true || value.Any(char.IsControl)) return false;
        return value.Split('/').Skip(1).All(segment =>
            IsCanonicalIndex(segment) ||
            IsHashSegment(segment) ||
            (allowKeywords && _keywordSegments.Contains(segment)));
    }

    static bool IsCanonicalIndex(string value) =>
        value.Length > 0 &&
        (value.Length == 1 || value[0] != '0') &&
        value.All(character => character is >= '0' and <= '9');

    static bool IsHashSegment(string value)
    {
        if (value is not { Length: 65 } || value[0] != '@') return false;
        foreach (var character in value.AsSpan(1))
        {
            if (character is not (>= '0' and <= '9') and not (>= 'a' and <= 'f')) return false;
        }
        return true;
    }

    static bool IsStrictlyOrdered<T>(IReadOnlyList<T> values, Func<T, T, int> compare)
    {
        for (var index = 1; index < values.Count; index++)
        {
            if (compare(values[index - 1], values[index]) >= 0) return false;
        }
        return true;
    }
}

sealed record OracleRequest(
    string ProtocolVersion,
    OracleSchemaDocument[] SchemaDocuments,
    string? RootSchemaId,
    string? InstanceBase64,
    int RepeatCount,
    int ParallelCount);

sealed record OracleSchemaDocument(string LogicalId, string InputBase64);

sealed record OracleResponse(
    string? ProtocolVersion,
    string? LoadStatus,
    OracleSchemaSet? SchemaSet,
    string? ValidationStatus,
    OracleSchemaClosure? Closure,
    OracleDiagnostic[]? Diagnostics,
    bool? RepeatDeterministic,
    bool? ParallelDeterministic);

sealed record OracleSchemaSet(
    string? Identity,
    OracleSchemaMember[]? Documents,
    OracleSchemaResource[]? Resources,
    int? ResourceCount,
    int? AnchorCount,
    int? ReferenceCount);

sealed record OracleSchemaClosure(
    string? RootSchemaId,
    string? Identity,
    OracleSchemaMember[]? Members,
    int? ResourceCount,
    int? AnchorCount,
    int? ReferenceCount);

sealed record OracleSchemaMember(string? SchemaId, string? ContentHash, int? ReferenceCount);

sealed record OracleSchemaResource(string? SchemaId, string? DocumentId, string? ContentHash, int? ReferenceCount);

sealed record OracleDiagnostic(
    string? Code,
    string? Status,
    string? Severity,
    string? SchemaId,
    string? InstanceLocation,
    string? KeywordLocation);
