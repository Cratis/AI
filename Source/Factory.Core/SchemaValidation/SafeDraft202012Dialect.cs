// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using System.Text.RegularExpressions;
using Json.Schema;
using Json.Schema.Keywords;
using Json.Schema.Keywords.Draft201909;

namespace Cratis.Factory.SchemaValidation;

static class SafeDraft202012Dialect
{
    public static Dialect Instance { get; } = new(
        AdditionalPropertiesKeyword.Instance,
        AllOfKeyword.Instance,
        SafeAnchorKeyword.Instance,
        AnyOfKeyword.Instance,
        CommentKeyword.Instance,
        ConstKeyword.Instance,
        ContainsKeyword.Instance,
        ContentEncodingKeyword.Instance,
        ContentMediaTypeKeyword.Instance,
        ContentSchemaKeyword.Instance,
        DefaultKeyword.Instance,
        DefsKeyword.Instance,
        DependentRequiredKeyword.Instance,
        DependentSchemasKeyword.Instance,
        DeprecatedKeyword.Instance,
        DescriptionKeyword.Instance,
        DynamicAnchorKeyword.Instance,
        Json.Schema.Keywords.Draft202012.DynamicRefKeyword.Instance,
        ElseKeyword.Instance,
        EnumKeyword.Instance,
        ExamplesKeyword.Instance,
        ExclusiveMaximumKeyword.Instance,
        ExclusiveMinimumKeyword.Instance,
        SafeFormatKeyword.Instance,
        SafeIdKeyword.Instance,
        IfKeyword.Instance,
        ItemsKeyword.Instance,
        MaxContainsKeyword.Instance,
        MaximumKeyword.Instance,
        MaxItemsKeyword.Instance,
        MaxLengthKeyword.Instance,
        MaxPropertiesKeyword.Instance,
        MinContainsKeyword.Instance,
        MinimumKeyword.Instance,
        MinItemsKeyword.Instance,
        MinLengthKeyword.Instance,
        MinPropertiesKeyword.Instance,
        MultipleOfKeyword.Instance,
        NotKeyword.Instance,
        OneOfKeyword.Instance,
        SafePatternKeyword.Instance,
        PatternPropertiesKeyword.Instance,
        PrefixItemsKeyword.Instance,
        PropertiesKeyword.Instance,
        PropertyNamesKeyword.Instance,
        ReadOnlyKeyword.Instance,
        SafeRefKeyword.Instance,
        RequiredKeyword.Instance,
        SchemaKeyword.Instance,
        ThenKeyword.Instance,
        TitleKeyword.Instance,
        TypeKeyword.Instance,
        Json.Schema.Keywords.UnevaluatedItemsKeyword.Instance,
        UnevaluatedPropertiesKeyword.Instance,
        SafeUniqueItemsKeyword.Instance,
        VocabularyKeyword.Instance,
        WriteOnlyKeyword.Instance)
    {
        Id = MetaSchemas.Draft202012Id,
        AllowUnknownKeywords = true,
        RefIgnoresSiblingKeywords = false
    };
}

sealed class SafePatternKeyword : PatternKeyword
{
    public const string MismatchMarker = "factory-pattern-mismatch";

    const string ControlsExceptLineFeedPattern = @"^(?![\s\S]*[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069])[\s\S]*$";
    const string ControlsPattern = @"^(?![\s\S]*[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069])[\s\S]*$";
    const string RelativePathPattern = @"^(?!\.\.(?:/|$))(?!.*\/\.\.(?:/|$))(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+$";

    public static new SafePatternKeyword Instance { get; } = new();

    public static SchemaDiagnosticCode? TryCreate(string pattern, out SafePatternMatcher? matcher)
    {
        matcher = null;
        if (pattern.EnumerateRunes().Count() > SchemaValidationLimits.MaximumPatternScalars)
        {
            return SchemaDiagnosticCode.PatternTooLong;
        }

        if (string.Equals(pattern, ControlsExceptLineFeedPattern, StringComparison.Ordinal))
        {
            matcher = SafePatternMatcher.ForControls(allowLineFeed: true);
            return null;
        }

        if (string.Equals(pattern, ControlsPattern, StringComparison.Ordinal))
        {
            matcher = SafePatternMatcher.ForControls(allowLineFeed: false);
            return null;
        }

        if (string.Equals(pattern, RelativePathPattern, StringComparison.Ordinal))
        {
            matcher = SafePatternMatcher.ForRelativePath();
            return null;
        }

        try
        {
            matcher = SafePatternMatcher.ForExpression(new(pattern, RegexOptions.CultureInvariant | RegexOptions.NonBacktracking));
            return null;
        }
        catch (Exception error) when (error is ArgumentException or NotSupportedException)
        {
            return SchemaDiagnosticCode.InvalidPattern;
        }
    }

    public override object ValidateKeywordValue(JsonElement value)
    {
        if (value.ValueKind is not JsonValueKind.String)
        {
            throw new JsonSchemaException("factory-invalid-pattern");
        }

        var pattern = value.GetString()!;
        var rejection = TryCreate(pattern, out var matcher);
        if (rejection is not null)
        {
            throw new JsonSchemaException("factory-invalid-pattern");
        }

        return matcher!;
    }

    public override KeywordEvaluation Evaluate(KeywordData keyword, EvaluationContext context)
    {
        if (context.Instance.ValueKind is not JsonValueKind.String) return KeywordEvaluation.Ignore;

        var isMatch = ((SafePatternMatcher)keyword.Value!).IsMatch(context.Instance.GetString()!);
        return new()
        {
            Keyword = Name,
            IsValid = isMatch,
            Error = isMatch ? null : MismatchMarker
        };
    }
}

sealed class SafePatternMatcher
{
    readonly Regex? _expression;
    readonly SafePatternKind _kind;

    SafePatternMatcher(SafePatternKind kind, Regex? expression = null)
    {
        _kind = kind;
        _expression = expression;
    }

    public static SafePatternMatcher ForControls(bool allowLineFeed) =>
        new(allowLineFeed ? SafePatternKind.ControlsExceptLineFeed : SafePatternKind.Controls);

    public static SafePatternMatcher ForExpression(Regex expression) => new(SafePatternKind.Expression, expression);

    public static SafePatternMatcher ForRelativePath() => new(SafePatternKind.RelativePath);

    public bool IsMatch(string value) => _kind switch
    {
        SafePatternKind.Controls => !ContainsForbiddenControl(value, allowLineFeed: false),
        SafePatternKind.ControlsExceptLineFeed => !ContainsForbiddenControl(value, allowLineFeed: true),
        SafePatternKind.RelativePath => IsRelativePath(value),
        _ => _expression!.IsMatch(value)
    };

    static bool ContainsForbiddenControl(string value, bool allowLineFeed)
    {
        foreach (var character in value)
        {
            if ((character <= '\u001f' && (!allowLineFeed || character != '\n')) ||
                (character is (>= '\u007f' and <= '\u009f') or
                 '\u061c' or
                 '\u200e' or
                 '\u200f' or
                 (>= '\u202a' and <= '\u202e') or
                 (>= '\u2066' and <= '\u2069')))
            {
                return true;
            }
        }

        return false;
    }

    static bool IsRelativePath(string value)
    {
        if (value.Length == 0) return false;

        var segmentStart = 0;
        for (var index = 0; index <= value.Length; index++)
        {
            if (index < value.Length && value[index] != '/')
            {
                var character = value[index];
                if (!((character is >= 'A' and <= 'Z') ||
                      (character is >= 'a' and <= 'z') ||
                      (character is >= '0' and <= '9') ||
                      character is '.' or '_' or '-'))
                {
                    return false;
                }

                continue;
            }

            var segmentLength = index - segmentStart;
            if (segmentLength == 0 ||
                (segmentLength == 2 && value[segmentStart] == '.' && value[segmentStart + 1] == '.'))
            {
                return false;
            }

            segmentStart = index + 1;
        }

        return true;
    }
}

sealed class SafeFormatKeyword : Json.Schema.Keywords.Draft06.FormatKeyword
{
    public const string FailureMarker = "factory-format-failed";

    public SafeFormatKeyword()
        : base(false)
    {
    }

    public static new SafeFormatKeyword Instance { get; } = new();

    public override KeywordEvaluation Evaluate(KeywordData keyword, EvaluationContext context)
    {
        var format = keyword.RawValue.GetString();
        var isValid = context.Instance.ValueKind is not JsonValueKind.String ||
                      !string.Equals(format, "uuid", StringComparison.Ordinal) ||
                      Guid.TryParseExact(context.Instance.GetString(), "D", out _);
        return new()
        {
            Keyword = Name,
            IsValid = isValid,
            Annotation = isValid ? keyword.RawValue : null,
            Error = isValid ? null : FailureMarker
        };
    }
}
