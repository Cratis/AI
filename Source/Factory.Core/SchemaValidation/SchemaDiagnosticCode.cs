// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Identifies deterministic schema loading and validation outcomes without package prose.
/// </summary>
public enum SchemaDiagnosticCode
{
    /// <summary>
    /// The caller supplied too many schema documents.
    /// </summary>
    DocumentLimitExceeded = 0,

    /// <summary>
    /// The aggregate schema input exceeds the byte limit.
    /// </summary>
    AggregateSchemaBytesLimitExceeded = 1,

    /// <summary>
    /// A canonical JSON input exceeds its byte limit.
    /// </summary>
    CanonicalInputTooLarge = 2,

    /// <summary>
    /// A canonical JSON output exceeds its byte limit.
    /// </summary>
    CanonicalOutputTooLarge = 3,

    /// <summary>
    /// A canonical JSON input begins with a byte order mark.
    /// </summary>
    CanonicalByteOrderMarkNotAllowed = 4,

    /// <summary>
    /// A canonical JSON input is not well-formed UTF-8.
    /// </summary>
    CanonicalMalformedUtf8 = 5,

    /// <summary>
    /// A canonical JSON input is not one well-formed JSON value.
    /// </summary>
    CanonicalMalformedJson = 6,

    /// <summary>
    /// A canonical JSON input contains an invalid Unicode scalar.
    /// </summary>
    CanonicalInvalidUnicodeScalar = 7,

    /// <summary>
    /// A canonical JSON string exceeds its scalar limit.
    /// </summary>
    CanonicalStringTooLong = 8,

    /// <summary>
    /// A canonical JSON input exceeds its nesting limit.
    /// </summary>
    CanonicalNestingTooDeep = 9,

    /// <summary>
    /// A canonical JSON input exceeds its structural-token limit.
    /// </summary>
    CanonicalStructuralTokenLimitExceeded = 10,

    /// <summary>
    /// A canonical JSON array exceeds its item limit.
    /// </summary>
    CanonicalArrayItemLimitExceeded = 11,

    /// <summary>
    /// A canonical JSON object exceeds its member limit.
    /// </summary>
    CanonicalObjectMemberLimitExceeded = 12,

    /// <summary>
    /// A canonical JSON object repeats a decoded key.
    /// </summary>
    CanonicalDuplicateObjectKey = 13,

    /// <summary>
    /// A canonical JSON number uses an unsupported form.
    /// </summary>
    CanonicalUnsupportedNumber = 14,

    /// <summary>
    /// A canonical JSON integer is outside the safe range.
    /// </summary>
    CanonicalIntegerOutOfRange = 15,

    /// <summary>
    /// A caller logical schema identifier is missing or invalid.
    /// </summary>
    InvalidSchemaId = 16,

    /// <summary>
    /// An object schema omits its required top-level <c>$id</c>.
    /// </summary>
    MissingSchemaId = 17,

    /// <summary>
    /// An object schema <c>$id</c> differs from its caller logical identifier.
    /// </summary>
    SchemaIdMismatch = 18,

    /// <summary>
    /// Two schema documents use the same logical identifier.
    /// </summary>
    DuplicateSchemaId = 19,

    /// <summary>
    /// A schema document is neither an object nor a Boolean schema.
    /// </summary>
    MalformedSchema = 20,

    /// <summary>
    /// An object schema omits its required top-level <c>$schema</c>.
    /// </summary>
    MissingDialect = 21,

    /// <summary>
    /// A schema declares a dialect other than Draft 2020-12.
    /// </summary>
    UnsupportedDialect = 22,

    /// <summary>
    /// A <c>$vocabulary</c> declaration is malformed.
    /// </summary>
    MalformedVocabulary = 23,

    /// <summary>
    /// A required vocabulary is not supported by this slice.
    /// </summary>
    UnsupportedVocabulary = 24,

    /// <summary>
    /// A known Draft 2020-12 keyword is outside this slice's supported surface.
    /// </summary>
    UnsupportedKeyword = 25,

    /// <summary>
    /// The schema resource count exceeds its limit.
    /// </summary>
    ResourceLimitExceeded = 26,

    /// <summary>
    /// Two top-level or embedded resources resolve to the same identifier.
    /// </summary>
    DuplicateResourceId = 27,

    /// <summary>
    /// An anchor does not use the Draft 2020-12 anchor syntax.
    /// </summary>
    InvalidAnchor = 28,

    /// <summary>
    /// An anchor is repeated within one schema resource.
    /// </summary>
    DuplicateAnchor = 29,

    /// <summary>
    /// The schema anchor count exceeds its limit.
    /// </summary>
    AnchorLimitExceeded = 30,

    /// <summary>
    /// The schema reference-edge count exceeds its limit.
    /// </summary>
    ReferenceLimitExceeded = 31,

    /// <summary>
    /// A reference is not a well-formed URI reference.
    /// </summary>
    InvalidReference = 32,

    /// <summary>
    /// A reference target is absent from the explicit resource closure.
    /// </summary>
    UnresolvedReference = 33,

    /// <summary>
    /// A reference cycle can recurse without consuming an instance location.
    /// </summary>
    UnproductiveReferenceCycle = 34,

    /// <summary>
    /// A regular expression exceeds its scalar limit.
    /// </summary>
    PatternTooLong = 35,

    /// <summary>
    /// A regular expression is invalid or outside the bounded supported surface.
    /// </summary>
    InvalidPattern = 36,

    /// <summary>
    /// The admitted schema could not be built by the wrapped validator.
    /// </summary>
    SchemaBuildFailed = 37,

    /// <summary>
    /// The requested root schema is absent from the resource set.
    /// </summary>
    SchemaNotFound = 38,

    /// <summary>
    /// A Boolean false schema rejected the instance.
    /// </summary>
    FalseSchema = 39,

    /// <summary>
    /// The <c>additionalProperties</c> assertion failed.
    /// </summary>
    AdditionalProperties = 40,

    /// <summary>
    /// The <c>allOf</c> assertion failed.
    /// </summary>
    AllOf = 41,

    /// <summary>
    /// The <c>anyOf</c> assertion failed.
    /// </summary>
    AnyOf = 42,

    /// <summary>
    /// The <see langword="const"/> assertion failed.
    /// </summary>
    Const = 43,

    /// <summary>
    /// The <c>contains</c> assertion failed.
    /// </summary>
    Contains = 44,

    /// <summary>
    /// The <see langword="enum"/> assertion failed.
    /// </summary>
    Enum = 45,

    /// <summary>
    /// The asserted <c>format</c> failed.
    /// </summary>
    Format = 46,

    /// <summary>
    /// The <c>items</c> assertion failed.
    /// </summary>
    Items = 47,

    /// <summary>
    /// The <c>maximum</c> assertion failed.
    /// </summary>
    Maximum = 48,

    /// <summary>
    /// The <c>maxItems</c> assertion failed.
    /// </summary>
    MaxItems = 49,

    /// <summary>
    /// The <c>maxLength</c> assertion failed.
    /// </summary>
    MaxLength = 50,

    /// <summary>
    /// The <c>minimum</c> assertion failed.
    /// </summary>
    Minimum = 51,

    /// <summary>
    /// The <c>minItems</c> assertion failed.
    /// </summary>
    MinItems = 52,

    /// <summary>
    /// The <c>minLength</c> assertion failed.
    /// </summary>
    MinLength = 53,

    /// <summary>
    /// The <c>not</c> assertion failed.
    /// </summary>
    Not = 54,

    /// <summary>
    /// The <c>oneOf</c> assertion failed.
    /// </summary>
    OneOf = 55,

    /// <summary>
    /// The <c>pattern</c> assertion failed.
    /// </summary>
    Pattern = 56,

    /// <summary>
    /// The <c>required</c> assertion failed.
    /// </summary>
    Required = 57,

    /// <summary>
    /// The <c>type</c> assertion failed.
    /// </summary>
    Type = 58,

    /// <summary>
    /// The <c>unevaluatedProperties</c> assertion failed.
    /// </summary>
    UnevaluatedProperties = 59,

    /// <summary>
    /// The <c>uniqueItems</c> assertion failed.
    /// </summary>
    UniqueItems = 60,

    /// <summary>
    /// A supported assertion failed without a more specific stable projection.
    /// </summary>
    ValidationFailed = 61,

    /// <summary>
    /// The validation produced more diagnostics than the result contract allows.
    /// </summary>
    DiagnosticLimitExceeded = 62,

    /// <summary>
    /// The caller supplied no schema documents.
    /// </summary>
    NoSchemaDocuments = 63,

    /// <summary>
    /// The schema resource set contains more schema positions than the validator admits.
    /// </summary>
    SchemaNodeLimitExceeded = 64,

    /// <summary>
    /// The caller instance contains more JSON values than one validation admits.
    /// </summary>
    InstanceNodeLimitExceeded = 65,

    /// <summary>
    /// The conservative schema-by-instance evaluation budget was exceeded.
    /// </summary>
    EvaluationWorkLimitExceeded = 66,

    /// <summary>
    /// A reference chain exceeds the bounded non-instance-consuming depth.
    /// </summary>
    ReferenceDepthLimitExceeded = 67,

    /// <summary>
    /// The caller's schema-document sequence could not be enumerated safely.
    /// </summary>
    SchemaDocumentEnumerationFailed = 68
}
