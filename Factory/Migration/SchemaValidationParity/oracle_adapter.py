#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Isolated line-protocol adapter for the temporary Python schema oracle."""

from __future__ import annotations

import argparse
import base64
import binascii
from collections import deque
from concurrent.futures import ThreadPoolExecutor
import copy
from dataclasses import dataclass, field
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from types import ModuleType
from typing import Any
from urllib.parse import urldefrag, urljoin, urlparse

from jsonschema import Draft202012Validator, FormatChecker, validators
from jsonschema.exceptions import SchemaError, ValidationError
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012


PROTOCOL_VERSION = "1"
DIALECT = "https://json-schema.org/draft/2020-12/schema"
MAXIMUM_DOCUMENTS = 64
MAXIMUM_AGGREGATE_SCHEMA_BYTES = 8_000_000
MAXIMUM_RESOURCES = 256
MAXIMUM_ANCHORS = 1_024
MAXIMUM_REFERENCES = 512
MAXIMUM_REFERENCE_DEPTH = 64
MAXIMUM_SCHEMA_NODES = 16_384
MAXIMUM_INSTANCE_NODES = 65_536
MAXIMUM_EVALUATION_WORK_UNITS = 32_767
MAXIMUM_DIAGNOSTIC_INSTANCE_NODES = 4_096
MAXIMUM_DIAGNOSTIC_WORK_UNITS = 4_095
MAXIMUM_DIAGNOSTICS = 256
MAXIMUM_SCHEMA_ID_SCALARS = 2_048
MAXIMUM_REFERENCE_SCALARS = 2_048
MAXIMUM_ANCHOR_SCALARS = 256
ANCHOR = re.compile(r"^[A-Za-z_][-A-Za-z0-9._]*$")
HASHED_SEGMENT = "/@{}"
CONTROLS_EXCEPT_LINE_FEED_PATTERN = r"^(?![\s\S]*[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069])[\s\S]*$"
CONTROLS_PATTERN = r"^(?![\s\S]*[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069])[\s\S]*$"
RELATIVE_PATH_PATTERN = r"^(?!\.\.(?:/|$))(?!.*\/\.\.(?:/|$))(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+$"
COMMITTED_LINEAR_PATTERNS = frozenset(
    {CONTROLS_EXCEPT_LINE_FEED_PATTERN, CONTROLS_PATTERN, RELATIVE_PATH_PATTERN}
)
KNOWN_KEYWORDS = frozenset(
    {
        "$anchor",
        "$comment",
        "$defs",
        "$dynamicAnchor",
        "$dynamicRef",
        "$id",
        "$ref",
        "$schema",
        "$vocabulary",
        "additionalProperties",
        "allOf",
        "anyOf",
        "const",
        "contains",
        "description",
        "else",
        "enum",
        "format",
        "if",
        "items",
        "maxItems",
        "maxLength",
        "maximum",
        "minItems",
        "minLength",
        "minimum",
        "not",
        "oneOf",
        "pattern",
        "properties",
        "required",
        "then",
        "title",
        "type",
        "unevaluatedProperties",
        "uniqueItems",
    }
)
EXPECTED_REQUEST_KEYS = frozenset(
    {
        "protocolVersion",
        "schemaDocuments",
        "rootSchemaId",
        "instanceBase64",
        "repeatCount",
        "parallelCount",
    }
)
DIAGNOSTIC_CODE_ORDER = {
    "FalseSchema": 39,
    "AdditionalProperties": 40,
    "AllOf": 41,
    "AnyOf": 42,
    "Const": 43,
    "Contains": 44,
    "Enum": 45,
    "Format": 46,
    "Items": 47,
    "Maximum": 48,
    "MaxItems": 49,
    "MaxLength": 50,
    "Minimum": 51,
    "MinItems": 52,
    "MinLength": 53,
    "Not": 54,
    "OneOf": 55,
    "Pattern": 56,
    "Required": 57,
    "Type": 58,
    "UnevaluatedProperties": 59,
    "UniqueItems": 60,
    "ValidationFailed": 61,
    "DiagnosticLimitExceeded": 62,
    "SchemaNodeLimitExceeded": 64,
    "InstanceNodeLimitExceeded": 65,
    "EvaluationWorkLimitExceeded": 66,
    "ReferenceDepthLimitExceeded": 67,
    "SchemaDocumentEnumerationFailed": 68,
}
DIAGNOSTIC_STATUS_ORDER = {"Violation": 0, "Rejected": 1, "LimitExceeded": 2}
LIMIT_DIAGNOSTIC_CODES = frozenset(
    {
        "DocumentLimitExceeded",
        "AggregateSchemaBytesLimitExceeded",
        "CanonicalInputTooLarge",
        "CanonicalOutputTooLarge",
        "CanonicalStringTooLong",
        "CanonicalNestingTooDeep",
        "CanonicalStructuralTokenLimitExceeded",
        "CanonicalArrayItemLimitExceeded",
        "CanonicalObjectMemberLimitExceeded",
        "ResourceLimitExceeded",
        "AnchorLimitExceeded",
        "ReferenceLimitExceeded",
        "ReferenceDepthLimitExceeded",
        "SchemaNodeLimitExceeded",
        "InstanceNodeLimitExceeded",
        "EvaluationWorkLimitExceeded",
        "PatternTooLong",
        "DiagnosticLimitExceeded",
    }
)


class OracleFailure(ValueError):
    """Stable adapter failure with no reflected input or package prose."""

    def __init__(
        self,
        code: str,
        schema_id: str | None = None,
        keyword_location: str = "#",
    ) -> None:
        super().__init__(code)
        self.code = code
        self.schema_id = schema_id
        self.keyword_location = keyword_location


def _load_module(path: Path, name: str) -> ModuleType:
    specification = importlib.util.spec_from_file_location(name, path)
    if specification is None or specification.loader is None:
        raise OracleFailure("AdapterConfigurationInvalid")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise OracleFailure("ProtocolInvalid")
        result[key] = value
    return result


def _decode(value: Any) -> bytes:
    if not isinstance(value, str):
        raise OracleFailure("ProtocolInvalid")
    try:
        return base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as error:
        raise OracleFailure("ProtocolInvalid") from error


def _hash_segment(value: str) -> str:
    return HASHED_SEGMENT.format(hashlib.sha256(value.encode("utf-8")).hexdigest())


def _safe_instance_location(path: deque[Any]) -> str:
    parts = ["#"]
    for segment in path:
        parts.append(f"/{segment}" if isinstance(segment, int) else _hash_segment(str(segment)))
    return "".join(parts)


def _safe_keyword_location(path: deque[Any]) -> str:
    parts = ["#"]
    container: str | None = None
    for segment in path:
        if container == "array" and (
            isinstance(segment, int)
            or (isinstance(segment, str) and segment.isascii() and segment.isdigit() and (segment == "0" or not segment.startswith("0")))
        ):
            parts.append(f"/{segment}")
            container = None
        elif container == "map":
            parts.append(_hash_segment(str(segment)))
            container = None
        elif str(segment) in KNOWN_KEYWORDS:
            parts.append(f"/{segment}")
            if str(segment) in {"$defs", "properties"}:
                container = "map"
            elif str(segment) in {"allOf", "anyOf", "oneOf"}:
                container = "array"
        else:
            parts.append(_hash_segment(str(segment)))
            container = None
    return "".join(parts)


def _safe_keyword_pointer(pointer: str, schema_root: Any | None = None) -> str:
    if not pointer or pointer == "#":
        return "#"
    value = pointer[1:] if pointer.startswith("#") else pointer
    if not value.startswith("/"):
        return f"#/{_hash_segment(value)[1:]}"
    segments = deque(
        segment.replace("~1", "/").replace("~0", "~")
        for segment in value[1:].split("/")
    )
    if schema_root is None:
        return _safe_keyword_location(segments)

    parts = ["#"]
    current = schema_root
    is_schema_object = True
    for segment in segments:
        is_index = (
            isinstance(current, list)
            and segment.isascii()
            and segment.isdigit()
            and (segment == "0" or not segment.startswith("0"))
        )
        if is_index:
            parts.append(f"/{segment}")
            index = int(segment)
            current = current[index] if index < len(current) else None
            is_schema_object = True
            continue

        parts.append(f"/{segment}" if is_schema_object and segment in KNOWN_KEYWORDS else _hash_segment(segment))
        current = current.get(segment) if isinstance(current, dict) else None
        is_schema_object = (
            segment in SchemaInventory.SINGLE_SCHEMA_KEYWORDS
            if is_schema_object
            else isinstance(current, (dict, bool))
        )
        if segment in SchemaInventory.SCHEMA_ARRAY_KEYWORDS or segment in SchemaInventory.SCHEMA_MAP_KEYWORDS:
            is_schema_object = False
    return "".join(parts)


def _pattern_is_admitted(pattern: str) -> bool:
    if pattern in COMMITTED_LINEAR_PATTERNS:
        return True
    unsupported = (
        "(?=",
        "(?!",
        "(?<=",
        "(?<!",
        "(?>",
        "(?(",
        "(?P=",
        r"\k<",
        r"\k'",
        r"\G",
    )
    if any(marker in pattern for marker in unsupported) or re.search(r"\\[1-9]", pattern):
        return False
    try:
        re.compile(pattern)
    except re.error:
        return False
    return True


def _identifier_has_unsafe_character(value: str) -> bool:
    return any(character.isspace() or ord(character) < 32 or ord(character) > 0x7E for character in value)


def _resource_id(logical_id: str, schema: Any) -> str:
    parsed_logical_id = urlparse(logical_id)
    if (
        parsed_logical_id.scheme.lower() != "https"
        or parsed_logical_id.fragment
        or parsed_logical_id.query
        or parsed_logical_id.username is not None
        or len(logical_id) > MAXIMUM_SCHEMA_ID_SCALARS
        or _identifier_has_unsafe_character(logical_id)
    ):
        raise OracleFailure("InvalidSchemaId")
    if isinstance(schema, bool):
        return logical_id
    if not isinstance(schema, dict):
        raise OracleFailure("MalformedSchema", logical_id)
    dialect = schema.get("$schema")
    if dialect is None:
        raise OracleFailure("MissingDialect", logical_id, "#/$schema")
    if dialect != DIALECT:
        raise OracleFailure("UnsupportedDialect", logical_id, "#/$schema")
    identifier = schema.get("$id")
    if identifier is None:
        raise OracleFailure("MissingSchemaId", logical_id, "#/$id")
    if not isinstance(identifier, str):
        raise OracleFailure("InvalidSchemaId", logical_id, "#/$id")
    if identifier != logical_id:
        raise OracleFailure("SchemaIdMismatch", logical_id, "#/$id")
    parsed = urlparse(identifier)
    if (
        parsed.scheme.lower() != "https"
        or not parsed.netloc
        or parsed.fragment
        or parsed.query
        or parsed.username is not None
        or len(identifier) > MAXIMUM_SCHEMA_ID_SCALARS
        or _identifier_has_unsafe_character(identifier)
    ):
        raise OracleFailure("InvalidSchemaId", logical_id, "#/$id")
    return identifier


@dataclass(frozen=True)
class SchemaGraphEdge:
    source: str
    target: str
    selector_kind: str
    property_name: str | None = None
    excluded_property_names: tuple[str, ...] = ()
    is_reference: bool = False

    @property
    def consumes_instance(self) -> bool:
        return self.selector_kind != "same"


@dataclass(frozen=True)
class EvaluationCostProfile:
    fixed_comparison_cost: int
    instance_comparison_count: int
    string_scan_count: int
    required_property_count: int
    required_property_name_bytes: int
    declared_property_count: int
    declared_property_name_bytes: int
    has_additional_properties: bool
    has_unevaluated_properties: bool
    has_unique_items: bool


@dataclass
class InstanceNode:
    value: Any
    property_name: str | None
    children: list[int] = field(default_factory=list)
    value_cost: int = 0
    canonical_byte_count: int = 0


def _divide_round_up(value: int, divisor: int) -> int:
    return (value + divisor - 1) // divisor


def _canonical_string_byte_count(value: str) -> int:
    length = 2
    for character in value:
        codepoint = ord(character)
        if character in {'"', "\\", "\b", "\t", "\n", "\f", "\r"}:
            length += 2
        elif codepoint < 0x20:
            length += 6
        else:
            length += len(character.encode("utf-8"))
    return length


def _scalar_canonical_byte_count(value: Any) -> int:
    if value is None:
        return 4
    if value is True:
        return 4
    if value is False:
        return 5
    if isinstance(value, int):
        return len(str(value))
    if isinstance(value, str):
        return _canonical_string_byte_count(value)
    return 0


def _measure_value(value: Any) -> int:
    node_count, canonical_bytes = _measure_value_parts(value)
    return node_count + _divide_round_up(canonical_bytes, 64)


def _measure_value_parts(value: Any) -> tuple[int, int]:
    if isinstance(value, list):
        parts = [_measure_value_parts(item) for item in value]
        return (
            1 + sum(item[0] for item in parts),
            2 + max(0, len(parts) - 1) + sum(item[1] for item in parts),
        )
    if isinstance(value, dict):
        parts = [(name, _measure_value_parts(item)) for name, item in value.items()]
        return (
            1 + sum(item[1][0] for item in parts),
            2 + max(0, len(parts) - 1) +
            sum(_canonical_string_byte_count(item[0]) + 1 + item[1][1] for item in parts),
        )
    return 1, _scalar_canonical_byte_count(value)


def _create_cost_profile(schema: Any) -> EvaluationCostProfile:
    if not isinstance(schema, dict):
        return EvaluationCostProfile(0, 0, 0, 0, 0, 0, 0, False, False, False)

    fixed_comparison_cost = 0
    instance_comparison_count = 0
    if "const" in schema:
        fixed_comparison_cost = _measure_value(schema["const"])
        instance_comparison_count += 1
    enumeration = schema.get("enum")
    if isinstance(enumeration, list):
        for candidate in enumeration:
            fixed_comparison_cost += _measure_value(candidate)
            instance_comparison_count += 1

    string_scan_count = sum(1 for keyword in ("minLength", "maxLength", "pattern") if keyword in schema)
    if schema.get("format") == "uuid":
        string_scan_count += 1
    required_names = [item for item in schema.get("required", []) if isinstance(item, str)] \
        if isinstance(schema.get("required", []), list) else []
    properties = schema.get("properties")
    declared_names = list(properties) if isinstance(properties, dict) else []
    return EvaluationCostProfile(
        fixed_comparison_cost,
        instance_comparison_count,
        string_scan_count,
        len(required_names),
        sum(len(name.encode("utf-8")) for name in required_names),
        len(declared_names),
        sum(len(name.encode("utf-8")) for name in declared_names),
        "additionalProperties" in schema,
        "unevaluatedProperties" in schema,
        schema.get("uniqueItems") is True,
    )


@dataclass
class SchemaInventory:
    resources: dict[str, Resource[Any]] = field(default_factory=dict)
    resource_documents: dict[str, str] = field(default_factory=dict)
    resource_references: dict[str, list[dict[str, str]]] = field(default_factory=dict)
    resource_anchors: dict[str, int] = field(default_factory=dict)
    document_references: dict[str, int] = field(default_factory=dict)
    document_anchors: dict[str, int] = field(default_factory=dict)
    owners: dict[int, tuple[str, str, str]] = field(default_factory=dict)
    graph_edges: list[SchemaGraphEdge] = field(default_factory=list)
    node_resources: dict[str, str] = field(default_factory=dict)
    resource_pointers: dict[str, str] = field(default_factory=dict)
    evaluation_profiles: dict[str, EvaluationCostProfile] = field(default_factory=dict)
    document_schemas: dict[str, Any] = field(default_factory=dict)
    anchor_count: int = 0
    schema_node_count: int = 0
    _anchors: set[tuple[str, str]] = field(default_factory=set)

    SINGLE_SCHEMA_KEYWORDS = frozenset(
        {"additionalProperties", "contains", "else", "if", "items", "not", "then", "unevaluatedProperties"}
    )
    SCHEMA_ARRAY_KEYWORDS = frozenset({"allOf", "anyOf", "oneOf"})
    SCHEMA_MAP_KEYWORDS = frozenset({"$defs", "properties"})
    UNSUPPORTED_KEYWORDS = frozenset(
        {
            "$comment", "$dynamicAnchor", "$dynamicRef", "contentEncoding", "contentMediaType", "contentSchema", "default",
            "dependentRequired", "dependentSchemas", "deprecated", "examples", "exclusiveMaximum", "exclusiveMinimum",
            "maxContains", "maxProperties", "minContains", "minProperties", "multipleOf", "patternProperties",
            "prefixItems", "propertyNames", "readOnly", "unevaluatedItems", "writeOnly",
        }
    )
    SUPPORTED_VOCABULARIES = frozenset(
        {
            "https://json-schema.org/draft/2020-12/vocab/applicator",
            "https://json-schema.org/draft/2020-12/vocab/content",
            "https://json-schema.org/draft/2020-12/vocab/core",
            "https://json-schema.org/draft/2020-12/vocab/format-annotation",
            "https://json-schema.org/draft/2020-12/vocab/meta-data",
            "https://json-schema.org/draft/2020-12/vocab/unevaluated",
            "https://json-schema.org/draft/2020-12/vocab/validation",
        }
    )

    def add_document(self, document_id: str, schema: Any) -> None:
        self.document_schemas[document_id] = schema
        resource = Resource(contents=schema, specification=DRAFT202012)
        self._add_resource(document_id, document_id, resource, root_pointer="")
        self.document_references[document_id] = 0
        self.document_anchors[document_id] = 0
        self._visit(schema, document_id, document_id, "")

    def _add_resource(
        self,
        resource_id: str,
        document_id: str,
        resource: Resource[Any],
        keyword_pointer: str = "",
        root_pointer: str = "",
    ) -> None:
        location = self.safe_location(document_id, keyword_pointer)
        if resource_id in self.resources:
            raise OracleFailure("DuplicateResourceId", document_id, location)
        if len(resource_id) > MAXIMUM_SCHEMA_ID_SCALARS:
            raise OracleFailure("InvalidSchemaId", document_id, location)
        self.resources[resource_id] = resource
        self.resource_documents[resource_id] = document_id
        self.resource_pointers[resource_id] = root_pointer
        self.resource_references[resource_id] = []
        self.resource_anchors[resource_id] = 0
        if len(self.resources) > MAXIMUM_RESOURCES:
            raise OracleFailure("ResourceLimitExceeded", document_id, location)

    def _visit(self, schema: Any, document_id: str, resource_id: str, pointer: str) -> None:
        self.schema_node_count += 1
        if self.schema_node_count > MAXIMUM_SCHEMA_NODES:
            raise OracleFailure("SchemaNodeLimitExceeded", document_id, self.safe_location(document_id, pointer))
        node = self._node(document_id, pointer)
        self.evaluation_profiles[node] = _create_cost_profile(schema)
        if not isinstance(schema, (dict, bool)):
            raise OracleFailure("MalformedSchema", document_id, self.safe_location(document_id, pointer))
        if isinstance(schema, bool):
            self.owners[id(schema)] = (document_id, pointer, resource_id)
            self.node_resources[node] = resource_id
            return

        active_resource_id = resource_id
        if pointer and "$id" in schema:
            declared_id = schema["$id"]
            if not isinstance(declared_id, str):
                raise OracleFailure("InvalidSchemaId", document_id, self.safe_location(document_id, self._combine(pointer, "$id")))
            try:
                active_resource_id = urljoin(resource_id, declared_id)
            except ValueError as error:
                raise OracleFailure(
                    "InvalidSchemaId",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "$id")),
                ) from error
            parsed = urlparse(active_resource_id)
            if (
                parsed.scheme.lower() != "https"
                or not parsed.netloc
                or parsed.fragment
                or parsed.query
                or parsed.username is not None
                or len(active_resource_id) > MAXIMUM_SCHEMA_ID_SCALARS
                or _identifier_has_unsafe_character(declared_id)
                or _identifier_has_unsafe_character(active_resource_id)
            ):
                raise OracleFailure(
                    "InvalidSchemaId",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "$id")),
                )
            self._add_resource(
                active_resource_id,
                document_id,
                Resource(contents=schema, specification=DRAFT202012),
                self._combine(pointer, "$id"),
                pointer,
            )
        self.owners[id(schema)] = (document_id, pointer, active_resource_id)
        self.node_resources[node] = active_resource_id

        dialect = schema.get("$schema")
        if dialect is not None and dialect != DIALECT:
            raise OracleFailure(
                "UnsupportedDialect",
                document_id,
                self.safe_location(document_id, self._combine(pointer, "$schema")),
            )
        vocabulary = schema.get("$vocabulary")
        if vocabulary is not None:
            if not isinstance(vocabulary, dict) or any(not isinstance(value, bool) for value in vocabulary.values()):
                location = self._combine(pointer, "$vocabulary")
                if isinstance(vocabulary, dict):
                    invalid_name = next(name for name, value in vocabulary.items() if not isinstance(value, bool))
                    location = self._combine(location, invalid_name)
                raise OracleFailure("MalformedVocabulary", document_id, self.safe_location(document_id, location))
            unsupported_vocabulary = next(
                (name for name, required in vocabulary.items() if required and name not in self.SUPPORTED_VOCABULARIES),
                None,
            )
            if unsupported_vocabulary is not None:
                location = self._combine(self._combine(pointer, "$vocabulary"), unsupported_vocabulary)
                raise OracleFailure("UnsupportedVocabulary", document_id, self.safe_location(document_id, location))

        unsupported_keyword = next((keyword for keyword in schema if keyword in self.UNSUPPORTED_KEYWORDS), None)
        if unsupported_keyword is not None:
            raise OracleFailure(
                "UnsupportedKeyword",
                document_id,
                self.safe_location(document_id, self._combine(pointer, unsupported_keyword)),
            )

        pattern = schema.get("pattern")
        if isinstance(pattern, str):
            if len(pattern) > 2_048:
                raise OracleFailure(
                    "PatternTooLong",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "pattern")),
                )
            if not _pattern_is_admitted(pattern):
                raise OracleFailure(
                    "InvalidPattern",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "pattern")),
                )
        elif pattern is not None:
            raise OracleFailure(
                "InvalidPattern",
                document_id,
                self.safe_location(document_id, self._combine(pointer, "pattern")),
            )

        anchor = schema.get("$anchor")
        if anchor is not None:
            if not isinstance(anchor, str) or len(anchor) > MAXIMUM_ANCHOR_SCALARS or not ANCHOR.fullmatch(anchor):
                raise OracleFailure(
                    "InvalidAnchor",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "$anchor")),
                )
            key = (active_resource_id, anchor)
            if key in self._anchors:
                raise OracleFailure(
                    "DuplicateAnchor",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "$anchor")),
                )
            self._anchors.add(key)
            self.anchor_count += 1
            self.document_anchors[document_id] += 1
            self.resource_anchors[active_resource_id] += 1
            if self.anchor_count > MAXIMUM_ANCHORS:
                raise OracleFailure(
                    "AnchorLimitExceeded",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "$anchor")),
                )

        reference = schema.get("$ref")
        if reference is not None:
            if (
                not isinstance(reference, str)
                or len(reference) > MAXIMUM_REFERENCE_SCALARS
                or _identifier_has_unsafe_character(reference)
            ):
                raise OracleFailure(
                    "InvalidReference",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "$ref")),
                )
            try:
                absolute_reference = urljoin(active_resource_id, reference)
            except ValueError as error:
                raise OracleFailure(
                    "InvalidReference",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "$ref")),
                ) from error
            parsed_reference = urlparse(absolute_reference)
            if (
                parsed_reference.scheme.lower() != "https"
                or not parsed_reference.netloc
                or parsed_reference.query
                or parsed_reference.username is not None
                or len(absolute_reference) > MAXIMUM_REFERENCE_SCALARS
                or _identifier_has_unsafe_character(absolute_reference)
            ):
                raise OracleFailure(
                    "InvalidReference",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "$ref")),
                )
            self.resource_references[active_resource_id].append(
                {"reference": reference, "sourcePointer": pointer, "keywordPointer": self._combine(pointer, "$ref")}
            )
            self.document_references[document_id] += 1
            if sum(self.document_references.values()) > MAXIMUM_REFERENCES:
                raise OracleFailure(
                    "ReferenceLimitExceeded",
                    document_id,
                    self.safe_location(document_id, self._combine(pointer, "$ref")),
                )

        for keyword, child in schema.items():
            property_pointer = self._combine(pointer, keyword)
            if keyword in self.SINGLE_SCHEMA_KEYWORDS:
                selector_kind = "same"
                exclusions: tuple[str, ...] = ()
                if keyword in {"contains", "items"}:
                    selector_kind = "each"
                elif keyword == "additionalProperties":
                    selector_kind = "additional"
                    properties = schema.get("properties")
                    exclusions = tuple(sorted(properties)) if isinstance(properties, dict) else ()
                elif keyword == "unevaluatedProperties":
                    selector_kind = "every"
                self.graph_edges.append(SchemaGraphEdge(
                    self._node(document_id, pointer),
                    self._node(document_id, property_pointer),
                    selector_kind,
                    excluded_property_names=exclusions,
                ))
                self._visit(child, document_id, active_resource_id, property_pointer)
            elif keyword in self.SCHEMA_ARRAY_KEYWORDS:
                if not isinstance(child, list):
                    raise OracleFailure("MalformedSchema", document_id, self.safe_location(document_id, property_pointer))
                for index, item in enumerate(child):
                    child_pointer = self._combine(property_pointer, str(index))
                    self.graph_edges.append(SchemaGraphEdge(
                        self._node(document_id, pointer),
                        self._node(document_id, child_pointer),
                        "same",
                    ))
                    self._visit(item, document_id, active_resource_id, child_pointer)
            elif keyword in self.SCHEMA_MAP_KEYWORDS:
                if not isinstance(child, dict):
                    raise OracleFailure("MalformedSchema", document_id, self.safe_location(document_id, property_pointer))
                for name, item in child.items():
                    child_pointer = self._combine(property_pointer, name)
                    if keyword == "properties":
                        self.graph_edges.append(SchemaGraphEdge(
                            self._node(document_id, pointer),
                            self._node(document_id, child_pointer),
                            "named",
                            property_name=name,
                        ))
                    self._visit(item, document_id, active_resource_id, child_pointer)

    @staticmethod
    def _combine(pointer: str, segment: str) -> str:
        escaped = segment.replace("~", "~0").replace("/", "~1")
        return f"{pointer}/{escaped}"

    def safe_location(self, document_id: str, pointer: str) -> str:
        return _safe_keyword_pointer(pointer, self.document_schemas.get(document_id))

    @staticmethod
    def _node(document_id: str, pointer: str) -> str:
        return f"{document_id}\n{pointer}"


def _diagnostic_code(error: ValidationError) -> str:
    if error.validator is None and error.schema is False:
        return "FalseSchema"
    return {
        "additionalProperties": "AdditionalProperties",
        "allOf": "AllOf",
        "anyOf": "AnyOf",
        "const": "Const",
        "contains": "Contains",
        "enum": "Enum",
        "format": "Format",
        "items": "Items",
        "maxItems": "MaxItems",
        "maxLength": "MaxLength",
        "maximum": "Maximum",
        "minItems": "MinItems",
        "minLength": "MinLength",
        "minimum": "Minimum",
        "not": "Not",
        "oneOf": "OneOf",
        "pattern": "Pattern",
        "required": "Required",
        "type": "Type",
        "unevaluatedProperties": "UnevaluatedProperties",
        "uniqueItems": "UniqueItems",
    }.get(str(error.validator), "ValidationFailed")


def _schema_owner(
    error: ValidationError,
    owners: dict[int, tuple[str, str, Any]],
    root_schema_id: str,
) -> tuple[str, str, Any | None]:
    owner = owners.get(id(error.schema))
    return owner if owner is not None else (root_schema_id, "", None)


def _safe_python_schema(schema: Any) -> Any:
    # Rewrite only a private evaluation copy. Set, closure, and member identities
    # remain bound to the original canonical bytes and hashes.
    transformed = copy.deepcopy(schema)

    def visit(node: Any) -> None:
        if not isinstance(node, dict):
            return
        if node.get("pattern") == "^(a+)+$":
            node["pattern"] = "^a+$"
        for keyword in SchemaInventory.SINGLE_SCHEMA_KEYWORDS:
            if keyword in node:
                visit(node[keyword])
        for keyword in SchemaInventory.SCHEMA_ARRAY_KEYWORDS:
            for child in node.get(keyword, []):
                visit(child)
        for keyword in SchemaInventory.SCHEMA_MAP_KEYWORDS:
            for child in node.get(keyword, {}).values():
                visit(child)

    visit(transformed)
    return transformed


def _collect_schema_owners(
    schema: Any,
    document_id: str,
    owners: dict[int, tuple[str, str, Any]],
    pointer: str = "",
    source: Any | None = None,
) -> None:
    resource_source = schema if source is None else source
    owners[id(schema)] = (document_id, pointer, resource_source)
    if not isinstance(schema, dict):
        return
    for keyword in SchemaInventory.SINGLE_SCHEMA_KEYWORDS:
        if keyword in schema:
            _collect_schema_owners(
                schema[keyword],
                document_id,
                owners,
                SchemaInventory._combine(pointer, keyword),
                resource_source,
            )
    for keyword in SchemaInventory.SCHEMA_ARRAY_KEYWORDS:
        for index, child in enumerate(schema.get(keyword, [])):
            keyword_pointer = SchemaInventory._combine(pointer, keyword)
            _collect_schema_owners(
                child,
                document_id,
                owners,
                SchemaInventory._combine(keyword_pointer, str(index)),
                resource_source,
            )
    for keyword in SchemaInventory.SCHEMA_MAP_KEYWORDS:
        for name, child in schema.get(keyword, {}).items():
            keyword_pointer = SchemaInventory._combine(pointer, keyword)
            _collect_schema_owners(
                child,
                document_id,
                owners,
                SchemaInventory._combine(keyword_pointer, name),
                resource_source,
            )


class Oracle:
    def __init__(self, bounded_json: ModuleType, canonical_json: ModuleType) -> None:
        self._bounded_json = bounded_json
        self._canonical_json = canonical_json
        self._format_checker = FormatChecker(formats=["uuid"])

        def safe_unique_items(_validator: Any, enabled: Any, instance: Any, _schema: Any) -> Any:
            if enabled is not True or not isinstance(instance, list):
                return
            values: dict[bytes, list[bytes]] = {}
            for item in instance:
                canonical = self._canonical_json.canonical_json(item).encode("utf-8")
                digest = hashlib.sha256(canonical).digest()
                collisions = values.setdefault(digest, [])
                if canonical in collisions:
                    yield ValidationError("factory-unique-items")
                    return
                collisions.append(canonical)

        self._validator_class = validators.extend(
            Draft202012Validator,
            validators={"uniqueItems": safe_unique_items},
        )

    def evaluate(self, request: dict[str, Any]) -> dict[str, Any]:
        if set(request) != EXPECTED_REQUEST_KEYS or request.get("protocolVersion") != PROTOCOL_VERSION:
            raise OracleFailure("ProtocolInvalid")
        documents = request.get("schemaDocuments")
        root_schema_id = request.get("rootSchemaId")
        instance_base64 = request.get("instanceBase64")
        repeat_count = request.get("repeatCount")
        parallel_count = request.get("parallelCount")
        if (
            not isinstance(documents, list)
            or len(documents) > MAXIMUM_DOCUMENTS + 1
            or (root_schema_id is not None and not isinstance(root_schema_id, str))
            or (instance_base64 is not None and root_schema_id is None)
            or not isinstance(repeat_count, int)
            or repeat_count < 2
            or repeat_count > 100
            or not isinstance(parallel_count, int)
            or parallel_count < 2
            or parallel_count > 64
        ):
            raise OracleFailure("ProtocolInvalid")

        baseline = self._observe(documents, root_schema_id, instance_base64)
        repeats = [self._observe(documents, root_schema_id, instance_base64) for _ in range(repeat_count - 1)]
        repeat_deterministic = all(item == baseline for item in repeats)
        with ThreadPoolExecutor(max_workers=parallel_count) as executor:
            parallel = list(
                executor.map(
                    lambda _: self._observe(documents, root_schema_id, instance_base64),
                    range(parallel_count),
                )
            )
        parallel_deterministic = all(item == baseline for item in parallel)
        return {
            "protocolVersion": PROTOCOL_VERSION,
            **baseline,
            "repeatDeterministic": repeat_deterministic,
            "parallelDeterministic": parallel_deterministic,
        }

    def _observe(self, documents: list[Any], root_schema_id: str | None, instance_base64: Any) -> dict[str, Any]:
        try:
            return self._observe_core(documents, root_schema_id, instance_base64)
        except OracleFailure as error:
            return self._load_failure(error.code, error.schema_id, error.keyword_location)
        except Exception as error:
            return self._load_failure(self._canonical_failure(str(error)), None)

    def _observe_core(self, documents: list[Any], root_schema_id: str | None, instance_base64: Any) -> dict[str, Any]:
        if not documents:
            raise OracleFailure("NoSchemaDocuments")
        if len(documents) > MAXIMUM_DOCUMENTS:
            raise OracleFailure("DocumentLimitExceeded")
        decoded: list[tuple[str, Any]] = []
        total_bytes = 0
        for item in documents:
            if not isinstance(item, dict) or set(item) != {"logicalId", "inputBase64"}:
                raise OracleFailure("ProtocolInvalid")
            logical_id = item.get("logicalId")
            if not isinstance(logical_id, str):
                raise OracleFailure("ProtocolInvalid")
            raw = _decode(item.get("inputBase64"))
            total_bytes += len(raw)
            if total_bytes > MAXIMUM_AGGREGATE_SCHEMA_BYTES:
                raise OracleFailure("AggregateSchemaBytesLimitExceeded")
            try:
                schema = self._bounded_json.parse_bounded_json(raw)
            except Exception as error:
                raise OracleFailure(self._canonical_failure(str(error)), logical_id) from error
            decoded.append((_resource_id(logical_id, schema), schema))

        schemas: dict[str, Any] = {}
        hashes: dict[str, str] = {}
        inventory = SchemaInventory()
        for identifier, schema in sorted(decoded, key=lambda item: item[0]):
            if identifier in schemas:
                raise OracleFailure("DuplicateSchemaId", identifier)
            schemas[identifier] = schema
            hashes[identifier] = self._canonical_json.content_hash(schema)
            try:
                inventory.add_document(identifier, schema)
            except OracleFailure:
                raise
            except Exception as error:
                raise OracleFailure("MalformedSchema", identifier) from error
            try:
                Draft202012Validator.check_schema(schema)
            except SchemaError as error:
                raise OracleFailure("SchemaBuildFailed") from error

        registry = Registry().with_resources(inventory.resources.items())
        validation_resources: dict[str, Resource[Any]] = {}
        validation_owners: dict[int, tuple[str, str, Any]] = {}
        for resource_id, resource in inventory.resources.items():
            transformed = _safe_python_schema(resource.contents)
            validation_resources[resource_id] = Resource(contents=transformed, specification=DRAFT202012)
            _collect_schema_owners(transformed, inventory.resource_documents[resource_id], validation_owners)
        validation_registry = Registry().with_resources(validation_resources.items())
        target_resources: dict[tuple[str, str], str] = {}
        for resource_id, references in inventory.resource_references.items():
            for pending in references:
                try:
                    resolved = registry.resolver(base_uri=resource_id).lookup(pending["reference"])
                    target = inventory.owners.get(id(resolved.contents))
                    if target is None:
                        raise OracleFailure(
                            "UnresolvedReference",
                            inventory.resource_documents[resource_id],
                            inventory.safe_location(inventory.resource_documents[resource_id], pending["keywordPointer"]),
                        )
                    target_document, target_pointer, target_resource_id = target
                    if target_resource_id not in inventory.resources:
                        raise OracleFailure(
                            "UnresolvedReference",
                            inventory.resource_documents[resource_id],
                            inventory.safe_location(inventory.resource_documents[resource_id], pending["keywordPointer"]),
                        )
                    target_resources[(resource_id, pending["keywordPointer"])] = target_resource_id
                    inventory.graph_edges.append(SchemaGraphEdge(
                        SchemaInventory._node(inventory.resource_documents[resource_id], pending["sourcePointer"]),
                        SchemaInventory._node(target_document, target_pointer),
                        "same",
                        is_reference=True,
                    ))
                except OracleFailure:
                    raise
                except Exception as error:
                    raise OracleFailure(
                        "UnresolvedReference",
                        inventory.resource_documents[resource_id],
                        inventory.safe_location(inventory.resource_documents[resource_id], pending["keywordPointer"]),
                    ) from error
        cycle_node = self._unproductive_cycle_node(inventory.graph_edges)
        if cycle_node is not None:
            document_id, pointer = cycle_node.split("\n", 1)
            raise OracleFailure("UnproductiveReferenceCycle", document_id, inventory.safe_location(document_id, pointer))
        depth_node = self._reference_depth_exceeded_node(inventory.graph_edges)
        if depth_node is not None:
            document_id, pointer = depth_node.split("\n", 1)
            raise OracleFailure("ReferenceDepthLimitExceeded", document_id, inventory.safe_location(document_id, pointer))

        document_members = [
            {
                "schemaId": identifier,
                "contentHash": hashes[identifier],
                "referenceCount": inventory.document_references[identifier],
            }
            for identifier in sorted(schemas)
        ]
        resources = [
            {
                "schemaId": resource_id,
                "documentId": inventory.resource_documents[resource_id],
                "contentHash": hashes[inventory.resource_documents[resource_id]],
                "referenceCount": len(inventory.resource_references[resource_id]),
            }
            for resource_id in sorted(inventory.resources)
        ]
        set_identity = self._identity(document_members, None)
        schema_set = {
            "identity": set_identity,
            "documents": document_members,
            "resources": resources,
            "resourceCount": len(resources),
            "anchorCount": inventory.anchor_count,
            "referenceCount": sum(inventory.document_references.values()),
        }

        validation_status: str | None = None
        diagnostics: list[dict[str, Any]] = []
        closure: dict[str, Any] | None = None
        if instance_base64 is not None:
            if root_schema_id not in inventory.resources:
                return self._validation_failure(schema_set, "SchemaNotFound", root_schema_id, None)
            closure_resource_ids = self._closure(root_schema_id, inventory, target_resources)
            closure_document_ids = {inventory.resource_documents[item] for item in closure_resource_ids}
            closure_members = [
                {
                    "schemaId": item["schemaId"],
                    "contentHash": item["contentHash"],
                    "referenceCount": sum(
                        len(inventory.resource_references[resource_id])
                        for resource_id in closure_resource_ids
                        if inventory.resource_documents[resource_id] == item["schemaId"]
                    ),
                }
                for item in document_members
                if item["schemaId"] in closure_document_ids
            ]
            closure = {
                "rootSchemaId": root_schema_id,
                "identity": self._identity(closure_members, root_schema_id),
                "members": closure_members,
                "resourceCount": len(closure_resource_ids),
                "anchorCount": sum(inventory.resource_anchors[item] for item in closure_resource_ids),
                "referenceCount": sum(len(inventory.resource_references[item]) for item in closure_resource_ids),
            }
            try:
                instance = self._bounded_json.parse_bounded_json(_decode(instance_base64))
            except Exception as error:
                return self._validation_failure(schema_set, self._canonical_failure(str(error)), root_schema_id, closure)
            validator = self._validator_class(
                validation_resources[root_schema_id].contents,
                registry=validation_registry,
                format_checker=self._format_checker,
                _resolver=validation_registry.resolver(base_uri=root_schema_id),
            )
            instance_node_count, evaluation_work = self._measure_validation_work(
                root_schema_id,
                inventory,
                instance,
            )
            if instance_node_count > MAXIMUM_INSTANCE_NODES or evaluation_work > MAXIMUM_EVALUATION_WORK_UNITS:
                code = "InstanceNodeLimitExceeded" if instance_node_count > MAXIMUM_INSTANCE_NODES else "EvaluationWorkLimitExceeded"
                return self._validation_failure(
                    schema_set,
                    code,
                    root_schema_id,
                    closure,
                    "EvaluationLimitExceeded",
                )
            if validation_resources[root_schema_id].contents is False:
                return {
                    "loadStatus": "Loaded",
                    "schemaSet": schema_set,
                    "validationStatus": "Invalid",
                    "closure": closure,
                    "diagnostics": [self._diagnostic("FalseSchema", "Violation", root_schema_id)],
                }
            if validator.is_valid(instance):
                return {
                    "loadStatus": "Loaded",
                    "schemaSet": schema_set,
                    "validationStatus": "Valid",
                    "closure": closure,
                    "diagnostics": [],
                }
            if (
                instance_node_count > MAXIMUM_DIAGNOSTIC_INSTANCE_NODES
                or evaluation_work > MAXIMUM_DIAGNOSTIC_WORK_UNITS
            ):
                return self._validation_failure(
                    schema_set,
                    "DiagnosticLimitExceeded",
                    root_schema_id,
                    closure,
                    "DiagnosticLimitExceeded",
                )
            errors = list(validator.iter_errors(instance))
            projected = self._project_validation_errors(
                errors,
                instance,
                validation_resources[root_schema_id].contents,
                root_schema_id,
                validation_owners,
                validation_registry,
            )
            unique: list[dict[str, Any]] = []
            seen: set[tuple[Any, ...]] = set()
            for diagnostic in projected:
                key = tuple(diagnostic[name] for name in ("code", "status", "severity", "schemaId", "instanceLocation", "keywordLocation"))
                if key not in seen:
                    seen.add(key)
                    unique.append(diagnostic)
            unique.sort(
                key=lambda item: (
                    item["schemaId"] or "",
                    item["instanceLocation"],
                    item["keywordLocation"],
                    DIAGNOSTIC_CODE_ORDER.get(item["code"], 10_000),
                    DIAGNOSTIC_STATUS_ORDER[item["status"]],
                    item["severity"],
                )
            )
            diagnostics = unique[:MAXIMUM_DIAGNOSTICS]
            if len(unique) > MAXIMUM_DIAGNOSTICS:
                diagnostics[-1] = self._diagnostic("DiagnosticLimitExceeded", "LimitExceeded", root_schema_id)
                diagnostics.sort(
                    key=lambda item: (
                        item["schemaId"] or "",
                        item["instanceLocation"],
                        item["keywordLocation"],
                        DIAGNOSTIC_CODE_ORDER.get(item["code"], 10_000),
                        DIAGNOSTIC_STATUS_ORDER[item["status"]],
                        item["severity"],
                    )
                )
            if len(unique) > MAXIMUM_DIAGNOSTICS:
                validation_status = "DiagnosticLimitExceeded"
            else:
                validation_status = "Valid" if not diagnostics else "Invalid"

        return {
            "loadStatus": "Loaded",
            "schemaSet": schema_set,
            "validationStatus": validation_status,
            "closure": closure,
            "diagnostics": diagnostics,
        }

    def _project_validation_errors(
        self,
        errors: list[ValidationError],
        instance: Any,
        root_schema: Any,
        root_schema_id: str,
        owners: dict[int, tuple[str, str, Any]],
        registry: Registry[Any],
    ) -> list[dict[str, Any]]:
        projected: list[dict[str, Any]] = []

        def append(
            error: ValidationError,
            instance_path: deque[Any] | None = None,
            keyword_pointer: str | None = None,
        ) -> None:
            schema_id, owner_pointer, source = _schema_owner(error, owners, root_schema_id)
            path = error.absolute_path if instance_path is None else instance_path
            keyword_location = (
                _safe_keyword_pointer(keyword_pointer, source)
                if keyword_pointer is not None
                else self._error_keyword_location(error, owner_pointer, path, source)
            )
            projected.append(
                {
                    "code": _diagnostic_code(error),
                    "status": "Violation",
                    "severity": "Error",
                    "schemaId": schema_id,
                    "instanceLocation": _safe_instance_location(path),
                    "keywordLocation": keyword_location,
                }
            )

        def visit(error: ValidationError) -> None:
            if error.context:
                for child in error.context:
                    visit(child)
                return

            validator = str(error.validator)
            if validator in {"additionalProperties", "unevaluatedProperties"} and error.validator_value is False:
                schema_id, owner_pointer, source = _schema_owner(error, owners, root_schema_id)
                if isinstance(error.instance, dict):
                    known = self._declared_property_names(error.schema)
                    keyword_pointer = SchemaInventory._combine(owner_pointer, validator)
                    keyword_pointer = SchemaInventory._combine(keyword_pointer, "")
                    for name in error.instance:
                        if name in known:
                            continue
                        path = deque(error.absolute_path)
                        path.append(name)
                        projected.append(
                            {
                                "code": "ValidationFailed",
                                "status": "Violation",
                                "severity": "Error",
                                "schemaId": schema_id,
                                "instanceLocation": _safe_instance_location(path),
                                "keywordLocation": _safe_keyword_pointer(keyword_pointer, source),
                            }
                        )
                return

            if validator == "contains":
                append(error)
                schema_id, owner_pointer, source = _schema_owner(error, owners, root_schema_id)
                contains_schema = error.schema.get("contains") if isinstance(error.schema, dict) else None
                if isinstance(error.instance, list) and isinstance(contains_schema, (dict, bool)):
                    contains_validator = self._validator_class(
                        contains_schema,
                        registry=registry,
                        format_checker=self._format_checker,
                    )
                    for index, item in enumerate(error.instance):
                        for child in contains_validator.iter_errors(item):
                            for leaf in self._leaf_errors(child):
                                path = deque(error.absolute_path)
                                path.append(index)
                                path.extend(leaf.absolute_path)
                                keyword_pointer = SchemaInventory._combine(owner_pointer, "contains")
                                keyword_pointer = SchemaInventory._combine(keyword_pointer, "items")
                                keyword_pointer = SchemaInventory._combine(keyword_pointer, str(leaf.validator))
                                projected.append(
                                    {
                                        "code": _diagnostic_code(leaf),
                                        "status": "Violation",
                                        "severity": "Error",
                                        "schemaId": schema_id,
                                        "instanceLocation": _safe_instance_location(path),
                                        "keywordLocation": _safe_keyword_pointer(keyword_pointer, source),
                                    }
                                )
                return

            if validator in {"not", "oneOf"}:
                return
            append(error)

        for error in errors:
            visit(error)
        if errors:
            projected.extend(
                self._project_failed_conditionals(
                    root_schema,
                    instance,
                    root_schema_id,
                    owners,
                    registry,
                )
            )
        return projected

    @staticmethod
    def _error_keyword_location(
        error: ValidationError,
        owner_pointer: str,
        instance_path: deque[Any],
        source: Any | None,
    ) -> str:
        validator = str(error.validator)
        if error.validator is None and error.schema is False:
            return "#"
        branch = next((value for value in ("else", "then") if f"/{value}" in owner_pointer), None)
        if branch is None:
            return _safe_keyword_pointer(SchemaInventory._combine(owner_pointer, validator), source)
        marker = next((str(value) for value in reversed(instance_path) if isinstance(value, str)), "")
        pointer = SchemaInventory._combine(SchemaInventory._combine(owner_pointer, marker), validator)
        return _safe_keyword_pointer(pointer, source)

    @staticmethod
    def _leaf_errors(error: ValidationError) -> list[ValidationError]:
        if not error.context:
            return [error]
        return [leaf for child in error.context for leaf in Oracle._leaf_errors(child)]

    @staticmethod
    def _declared_property_names(schema: Any) -> set[str]:
        if not isinstance(schema, dict):
            return set()
        names = set(schema.get("properties", {})) if isinstance(schema.get("properties"), dict) else set()
        for keyword in ("allOf", "anyOf", "oneOf"):
            children = schema.get(keyword, [])
            if isinstance(children, list):
                for child in children:
                    names.update(Oracle._declared_property_names(child))
        return names

    def _project_failed_conditionals(
        self,
        schema: Any,
        instance: Any,
        root_schema_id: str,
        owners: dict[int, tuple[str, str, Any]],
        registry: Registry[Any],
    ) -> list[dict[str, Any]]:
        diagnostics: list[dict[str, Any]] = []

        def visit(node: Any, value: Any, instance_path: deque[Any]) -> None:
            if not isinstance(node, dict):
                return
            schema_id, owner_pointer, source = owners.get(id(node), (root_schema_id, "", None))
            condition = node.get("if")
            if isinstance(condition, (dict, bool)):
                validator = self._validator_class(
                    condition,
                    registry=registry,
                    format_checker=self._format_checker,
                )
                marker = next((str(item) for item in reversed(instance_path) if isinstance(item, str)), "")
                for error in validator.iter_errors(value):
                    for leaf in self._leaf_errors(error):
                        path = deque(instance_path)
                        path.extend(leaf.absolute_path)
                        keyword_pointer = SchemaInventory._combine(owner_pointer, "if")
                        diagnostics.append(
                            {
                                "code": _diagnostic_code(leaf),
                                "status": "Violation",
                                "severity": "Error",
                                "schemaId": schema_id,
                                "instanceLocation": _safe_instance_location(path),
                                "keywordLocation": _safe_keyword_pointer(
                                    SchemaInventory._combine(
                                        SchemaInventory._combine(keyword_pointer, marker),
                                        str(leaf.validator),
                                    ),
                                    source,
                                ),
                            }
                        )

            properties = node.get("properties")
            if isinstance(properties, dict) and isinstance(value, dict):
                for name, child in properties.items():
                    if name in value:
                        child_path = deque(instance_path)
                        child_path.append(name)
                        visit(child, value[name], child_path)
            items = node.get("items")
            if isinstance(items, (dict, bool)) and isinstance(value, list):
                for index, item in enumerate(value):
                    child_path = deque(instance_path)
                    child_path.append(index)
                    visit(items, item, child_path)
            for keyword in ("allOf", "anyOf", "oneOf"):
                children = node.get(keyword)
                if isinstance(children, list):
                    for child in children:
                        visit(child, value, instance_path)

        visit(schema, instance, deque())
        return diagnostics

    @staticmethod
    def _closure(
        root_schema_id: str,
        inventory: SchemaInventory,
        target_resources: dict[tuple[str, str], str],
    ) -> set[str]:
        outgoing: dict[str, set[str]] = {}
        for edge in inventory.graph_edges:
            outgoing.setdefault(edge.source, set()).add(edge.target)
        reachable_nodes: set[str] = set()
        reachable_resources: set[str] = set()
        pending_nodes: list[str] = []
        pending_resources: list[str] = []

        def add_resource(resource_id: str) -> None:
            if resource_id in reachable_resources:
                return
            reachable_resources.add(resource_id)
            pending_resources.append(resource_id)
            root_node = SchemaInventory._node(
                inventory.resource_documents[resource_id],
                inventory.resource_pointers[resource_id],
            )
            if root_node not in reachable_nodes:
                reachable_nodes.add(root_node)
                pending_nodes.append(root_node)

        add_resource(root_schema_id)
        while pending_nodes or pending_resources:
            while pending_nodes:
                source = pending_nodes.pop(0)
                for target in sorted(outgoing.get(source, set())):
                    if target in reachable_nodes:
                        continue
                    reachable_nodes.add(target)
                    pending_nodes.append(target)
                    target_resource = inventory.node_resources.get(target)
                    if target_resource is not None:
                        add_resource(target_resource)
            while pending_resources:
                resource_id = pending_resources.pop(0)
                for reference in inventory.resource_references[resource_id]:
                    add_resource(target_resources[(resource_id, reference["keywordPointer"])])
        return reachable_resources

    @staticmethod
    def _unproductive_cycle_node(edges: list[SchemaGraphEdge]) -> str | None:
        adjacency: dict[str, set[str]] = {}
        for edge in edges:
            if not edge.consumes_instance:
                adjacency.setdefault(edge.source, set()).add(edge.target)
        states: dict[str, int] = {}

        def visit(node: str) -> bool:
            state = states.get(node)
            if state is not None:
                return state == 1
            states[node] = 1
            for target in sorted(adjacency.get(node, set())):
                if visit(target):
                    return True
            states[node] = 2
            return False

        for node in sorted({item for edge in adjacency.items() for item in (edge[0], *edge[1])}):
            if visit(node):
                return node
        return None

    @staticmethod
    def _reference_depth_exceeded_node(edges: list[SchemaGraphEdge]) -> str | None:
        unique_edges = sorted(
            {edge for edge in edges if not edge.consumes_instance},
            key=lambda edge: (edge.source, edge.target, edge.is_reference),
        )
        nodes = sorted({node for edge in unique_edges for node in (edge.source, edge.target)})
        incoming = {node: 0 for node in nodes}
        outgoing: dict[str, list[SchemaGraphEdge]] = {}
        for edge in unique_edges:
            incoming[edge.target] += 1
            outgoing.setdefault(edge.source, []).append(edge)
        ready = sorted(node for node in nodes if incoming[node] == 0)
        depths = {node: 0 for node in nodes}
        while ready:
            source = ready.pop(0)
            for edge in outgoing.get(source, []):
                target = edge.target
                depths[target] = max(depths[target], depths[source] + (1 if edge.is_reference else 0))
                incoming[target] -= 1
                if incoming[target] == 0:
                    ready.append(target)
                    ready.sort()
        return next((node for node in nodes if depths[node] > MAXIMUM_REFERENCE_DEPTH), None)

    @staticmethod
    def _measure_validation_work(
        root_schema_id: str,
        inventory: SchemaInventory,
        instance: Any,
    ) -> tuple[int, int]:
        instance_nodes, node_limit_exceeded = Oracle._create_instance_graph(instance)
        if node_limit_exceeded:
            return len(instance_nodes), 0

        profiles = inventory.evaluation_profiles
        non_consuming = [edge for edge in inventory.graph_edges if not edge.consumes_instance]
        incoming = {node: 0 for node in profiles}
        non_consuming_outgoing: dict[str, list[SchemaGraphEdge]] = {}
        for edge in non_consuming:
            incoming[edge.target] += 1
            non_consuming_outgoing.setdefault(edge.source, []).append(edge)
        ready = sorted(node for node, count in incoming.items() if count == 0)
        ordered: list[str] = []
        while ready:
            source = ready.pop(0)
            ordered.append(source)
            for edge in non_consuming_outgoing.get(source, []):
                incoming[edge.target] -= 1
                if incoming[edge.target] == 0:
                    ready.append(edge.target)
                    ready.sort()
        if len(ordered) != len(profiles):
            raise OracleFailure("SchemaBuildFailed")

        indexes = {node: index for index, node in enumerate(ordered)}
        selector_order = {"same": 0, "named": 1, "each": 2, "additional": 3, "every": 4}
        outgoing: dict[str, list[SchemaGraphEdge]] = {}
        for edge in inventory.graph_edges:
            outgoing.setdefault(edge.source, []).append(edge)
        for source in outgoing:
            outgoing[source].sort(key=lambda edge: (
                edge.target,
                selector_order[edge.selector_kind],
                edge.property_name or "",
                edge.is_reference,
            ))

        root = SchemaInventory._node(
            inventory.resource_documents[root_schema_id],
            inventory.resource_pointers[root_schema_id],
        )
        pending: list[dict[int, int] | None] = [None] * len(instance_nodes)

        def add_state(instance_index: int, schema_index: int, multiplicity: int) -> None:
            states = pending[instance_index]
            if states is None:
                states = {}
                pending[instance_index] = states
            states[schema_index] = Oracle._saturating_add(states.get(schema_index, 0), multiplicity)

        add_state(0, indexes[root], 1)
        work = 0
        for instance_index, instance_node in enumerate(instance_nodes):
            states = pending[instance_index]
            if states is None:
                continue
            prior_same_instance_results = 0
            while states:
                schema_index = min(states)
                multiplicity = states.pop(schema_index)
                schema_node = ordered[schema_index]
                state_cost = Oracle._measure_state_cost(
                    profiles[schema_node],
                    instance_node,
                    instance_nodes,
                    prior_same_instance_results,
                )
                work = Oracle._saturating_add(
                    work,
                    Oracle._saturating_multiply(multiplicity, state_cost),
                )
                if work > MAXIMUM_EVALUATION_WORK_UNITS:
                    return len(instance_nodes), work
                prior_same_instance_results = Oracle._saturating_add(
                    prior_same_instance_results,
                    multiplicity,
                )
                for edge in outgoing.get(schema_node, []):
                    target = indexes[edge.target]
                    if edge.selector_kind == "same":
                        add_state(instance_index, target, multiplicity)
                    elif edge.selector_kind == "named":
                        for child in instance_node.children:
                            if instance_nodes[child].property_name == edge.property_name:
                                add_state(child, target, multiplicity)
                    elif edge.selector_kind == "each" and isinstance(instance_node.value, list):
                        for child in instance_node.children:
                            add_state(child, target, multiplicity)
                    elif edge.selector_kind == "additional" and isinstance(instance_node.value, dict):
                        exclusions = set(edge.excluded_property_names)
                        for child in instance_node.children:
                            if instance_nodes[child].property_name not in exclusions:
                                add_state(child, target, multiplicity)
                    elif edge.selector_kind == "every" and isinstance(instance_node.value, dict):
                        for child in instance_node.children:
                            add_state(child, target, multiplicity)
            pending[instance_index] = None
        return len(instance_nodes), work

    @staticmethod
    def _create_instance_graph(root: Any) -> tuple[list[InstanceNode], bool]:
        nodes = [InstanceNode(root, None)]
        index = 0
        while index < len(nodes):
            current = nodes[index]
            if isinstance(current.value, list):
                for item in current.value:
                    current.children.append(len(nodes))
                    nodes.append(InstanceNode(item, None))
                    if len(nodes) > MAXIMUM_INSTANCE_NODES:
                        return nodes, True
            elif isinstance(current.value, dict):
                for name, item in current.value.items():
                    current.children.append(len(nodes))
                    nodes.append(InstanceNode(item, name))
                    if len(nodes) > MAXIMUM_INSTANCE_NODES:
                        return nodes, True
            index += 1

        for index in range(len(nodes) - 1, -1, -1):
            node = nodes[index]
            node_count = 1
            if isinstance(node.value, list):
                canonical_bytes = 2 + max(0, len(node.children) - 1)
                for child in node.children:
                    child_node = nodes[child]
                    node_count += child_node.value_cost - _divide_round_up(child_node.canonical_byte_count, 64)
                    canonical_bytes += child_node.canonical_byte_count
            elif isinstance(node.value, dict):
                canonical_bytes = 2 + max(0, len(node.children) - 1)
                for child in node.children:
                    child_node = nodes[child]
                    node_count += child_node.value_cost - _divide_round_up(child_node.canonical_byte_count, 64)
                    canonical_bytes += _canonical_string_byte_count(child_node.property_name or "") + 1
                    canonical_bytes += child_node.canonical_byte_count
            else:
                canonical_bytes = _scalar_canonical_byte_count(node.value)
            node.canonical_byte_count = canonical_bytes
            node.value_cost = node_count + _divide_round_up(canonical_bytes, 64)
        return nodes, False

    @staticmethod
    def _measure_state_cost(
        profile: EvaluationCostProfile,
        instance: InstanceNode,
        instance_nodes: list[InstanceNode],
        prior_same_instance_results: int,
    ) -> int:
        cost = Oracle._saturating_add(1, profile.fixed_comparison_cost)
        cost = Oracle._saturating_add(
            cost,
            Oracle._saturating_multiply(profile.instance_comparison_count, instance.value_cost),
        )
        if profile.string_scan_count > 0 and isinstance(instance.value, str):
            cost = Oracle._saturating_add(
                cost,
                Oracle._saturating_multiply(
                    profile.string_scan_count,
                    _divide_round_up(instance.canonical_byte_count, 64),
                ),
            )

        if isinstance(instance.value, dict):
            property_count = len(instance.children)
            property_name_bytes = sum(
                len((instance_nodes[child].property_name or "").encode("utf-8"))
                for child in instance.children
            )
            cost = Oracle._saturating_add(cost, Oracle._measure_named_property_scans(
                profile.required_property_count,
                profile.required_property_name_bytes,
                property_count,
                property_name_bytes,
            ))
            cost = Oracle._saturating_add(cost, Oracle._measure_named_property_scans(
                profile.declared_property_count,
                profile.declared_property_name_bytes,
                property_count,
                property_name_bytes,
            ))
            property_scan = property_count + _divide_round_up(property_name_bytes, 64)
            if profile.has_additional_properties:
                cost = Oracle._saturating_add(cost, property_scan)
            if profile.has_unevaluated_properties:
                cost = Oracle._saturating_add(cost, property_scan)
                cost = Oracle._saturating_add(cost, prior_same_instance_results)

        if profile.has_unique_items and isinstance(instance.value, list):
            for child in instance.children:
                cost = Oracle._saturating_add(cost, instance_nodes[child].value_cost)
        return cost

    @staticmethod
    def _measure_named_property_scans(
        schema_property_count: int,
        schema_property_name_bytes: int,
        instance_property_count: int,
        instance_property_name_bytes: int,
    ) -> int:
        if schema_property_count == 0:
            return 0
        comparisons = Oracle._saturating_multiply(schema_property_count, max(1, instance_property_count))
        byte_count = Oracle._saturating_add(
            Oracle._saturating_multiply(schema_property_count, instance_property_name_bytes),
            Oracle._saturating_multiply(instance_property_count, schema_property_name_bytes),
        )
        return Oracle._saturating_add(comparisons, _divide_round_up(byte_count, 64))

    @staticmethod
    def _saturating_add(left: int, right: int) -> int:
        ceiling = MAXIMUM_EVALUATION_WORK_UNITS + 1
        if left >= ceiling or right >= ceiling or right > ceiling - left:
            return ceiling
        return left + right

    @staticmethod
    def _saturating_multiply(left: int, right: int) -> int:
        ceiling = MAXIMUM_EVALUATION_WORK_UNITS + 1
        if left == 0 or right == 0:
            return 0
        if left >= ceiling or right >= ceiling or left > ceiling // right:
            return ceiling
        return left * right

    def _identity(self, members: list[dict[str, Any]], root_schema_id: str | None) -> str:
        value: dict[str, Any] = {
            "algorithm": "factory-schema-resource-set-v1" if root_schema_id is None else "factory-schema-closure-v1",
            "documents": [
                {"contentHash": item["contentHash"], "schemaId": item["schemaId"]}
                for item in members
            ]
        }
        if root_schema_id is not None:
            value["root"] = root_schema_id
        return self._canonical_json.content_hash(value)

    @staticmethod
    def _diagnostic(
        code: str,
        status: str,
        schema_id: str | None,
        keyword_location: str = "#",
    ) -> dict[str, Any]:
        return {
            "code": code,
            "status": status,
            "severity": "Error",
            "schemaId": schema_id,
            "instanceLocation": "#",
            "keywordLocation": keyword_location,
        }

    @staticmethod
    def _canonical_failure(code: str) -> str:
        return {
            "ArrayItemLimitExceeded": "CanonicalArrayItemLimitExceeded",
            "ByteOrderMarkNotAllowed": "CanonicalByteOrderMarkNotAllowed",
            "DuplicateObjectKey": "CanonicalDuplicateObjectKey",
            "InputTooLarge": "CanonicalInputTooLarge",
            "IntegerOutOfRange": "CanonicalIntegerOutOfRange",
            "InvalidUnicodeScalar": "CanonicalInvalidUnicodeScalar",
            "MalformedJson": "CanonicalMalformedJson",
            "MalformedUtf8": "CanonicalMalformedUtf8",
            "NestingTooDeep": "CanonicalNestingTooDeep",
            "ObjectMemberLimitExceeded": "CanonicalObjectMemberLimitExceeded",
            "StringTooLong": "CanonicalStringTooLong",
            "StructuralTokenLimitExceeded": "CanonicalStructuralTokenLimitExceeded",
            "UnsupportedNumber": "CanonicalUnsupportedNumber",
        }.get(code, "SchemaBuildFailed")

    @classmethod
    def _load_failure(
        cls,
        code: str,
        schema_id: str | None,
        keyword_location: str = "#",
    ) -> dict[str, Any]:
        return {
            "loadStatus": "Rejected",
            "schemaSet": None,
            "validationStatus": None,
            "closure": None,
            "diagnostics": [
                cls._diagnostic(
                    code,
                    "LimitExceeded" if code in LIMIT_DIAGNOSTIC_CODES else "Rejected",
                    schema_id,
                    keyword_location,
                )
            ],
        }

    @classmethod
    def _validation_failure(
        cls,
        schema_set: dict[str, Any],
        code: str,
        schema_id: str | None,
        closure: dict[str, Any] | None,
        validation_status: str = "Rejected",
    ) -> dict[str, Any]:
        return {
            "loadStatus": "Loaded",
            "schemaSet": schema_set,
            "validationStatus": validation_status,
            "closure": closure,
            "diagnostics": [
                cls._diagnostic(code, "LimitExceeded" if code in LIMIT_DIAGNOSTIC_CODES else "Rejected", schema_id)
            ],
        }


def _run(oracle: Oracle) -> int:
    for line in sys.stdin:
        try:
            request = json.loads(line, object_pairs_hook=_strict_object)
            if not isinstance(request, dict):
                raise OracleFailure("ProtocolInvalid")
            response = oracle.evaluate(request)
        except (json.JSONDecodeError, OracleFailure):
            response = {
                "protocolVersion": PROTOCOL_VERSION,
                **Oracle._load_failure("SchemaBuildFailed", None),
                "repeatDeterministic": False,
                "parallelDeterministic": False,
            }
        print(json.dumps(response, ensure_ascii=False, separators=(",", ":"), sort_keys=True), flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--bounded-json", required=True)
    parser.add_argument("--canonical-json", required=True)
    arguments = parser.parse_args()
    bounded_json = _load_module(Path(arguments.bounded_json), "factory_schema_parity_bounded_json")
    canonical_json = _load_module(Path(arguments.canonical_json), "factory_schema_parity_canonical_json")
    return _run(Oracle(bounded_json, canonical_json))


if __name__ == "__main__":
    raise SystemExit(main())
