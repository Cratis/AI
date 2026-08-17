// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Canonicalization;

namespace Cratis.Factory.SchemaValidation;

static class SchemaCanonicalFailureProjection
{
    public static SchemaDiagnosticCode ToDiagnosticCode(CanonicalJsonFailureCode code) => code switch
    {
        CanonicalJsonFailureCode.InputTooLarge => SchemaDiagnosticCode.CanonicalInputTooLarge,
        CanonicalJsonFailureCode.CanonicalOutputTooLarge => SchemaDiagnosticCode.CanonicalOutputTooLarge,
        CanonicalJsonFailureCode.ByteOrderMarkNotAllowed => SchemaDiagnosticCode.CanonicalByteOrderMarkNotAllowed,
        CanonicalJsonFailureCode.MalformedUtf8 => SchemaDiagnosticCode.CanonicalMalformedUtf8,
        CanonicalJsonFailureCode.MalformedJson => SchemaDiagnosticCode.CanonicalMalformedJson,
        CanonicalJsonFailureCode.InvalidUnicodeScalar => SchemaDiagnosticCode.CanonicalInvalidUnicodeScalar,
        CanonicalJsonFailureCode.StringTooLong => SchemaDiagnosticCode.CanonicalStringTooLong,
        CanonicalJsonFailureCode.NestingTooDeep => SchemaDiagnosticCode.CanonicalNestingTooDeep,
        CanonicalJsonFailureCode.StructuralTokenLimitExceeded => SchemaDiagnosticCode.CanonicalStructuralTokenLimitExceeded,
        CanonicalJsonFailureCode.ArrayItemLimitExceeded => SchemaDiagnosticCode.CanonicalArrayItemLimitExceeded,
        CanonicalJsonFailureCode.ObjectMemberLimitExceeded => SchemaDiagnosticCode.CanonicalObjectMemberLimitExceeded,
        CanonicalJsonFailureCode.DuplicateObjectKey => SchemaDiagnosticCode.CanonicalDuplicateObjectKey,
        CanonicalJsonFailureCode.UnsupportedNumber => SchemaDiagnosticCode.CanonicalUnsupportedNumber,
        CanonicalJsonFailureCode.IntegerOutOfRange => SchemaDiagnosticCode.CanonicalIntegerOutOfRange,
        _ => SchemaDiagnosticCode.CanonicalMalformedJson
    };
}
