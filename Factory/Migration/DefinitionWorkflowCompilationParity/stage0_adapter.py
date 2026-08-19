#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

import base64
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types


def load(name, path):
    specification = importlib.util.spec_from_file_location(name, path)
    if specification is None or specification.loader is None:
        raise RuntimeError()
    module = importlib.util.module_from_spec(specification)
    sys.modules[name] = module
    specification.loader.exec_module(module)
    return module


def definition_path(root, ordinal, logical_id, kind):
    safe = f"definition-{ordinal:03d}"
    if kind == "workflow":
        return root / "Workflows" / f"{ordinal:03d}-{safe}.factory.json"
    if kind == "capability-catalog":
        return root / "Factory" / "Capabilities" / f"{ordinal:03d}-{safe}.json"
    return root / "Definitions" / f"{ordinal:03d}-{safe}.json"


def main():
    if len(sys.argv) != 2:
        return 1
    oracle = Path(sys.argv[1])
    sys.modules["operation_result"] = types.ModuleType("operation_result")
    sys.modules["artifact_provenance"] = types.ModuleType("artifact_provenance")
    load("canonical_json", oracle / "canonical_json.py")
    validate = load("validate_factory", oracle / "validate_factory.py")
    compile_factory = load("compile_factory", oracle / "compile_factory.py")
    request = json.load(sys.stdin)
    response = []
    with tempfile.TemporaryDirectory(prefix="definition-workflow-stage0-") as directory:
        root = Path(directory)
        for relative, encoded in request["schemas"].items():
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(base64.b64decode(encoded))
        validate.ROOT = root
        validate.CONTRACTS_ROOT = root / "Contracts"
        validate.CONTRACTS = root / "Contracts" / "v1"
        validate.CONTRACTS_V2 = root / "Contracts" / "v2"
        validate.WORKFLOWS = root / "Workflows"
        validate.PROFILES = root / "Factory" / "Profiles"
        validate.POLICIES = root / "Factory" / "Policies"
        validate.CAPABILITIES = root / "Factory" / "Capabilities"
        validate.EVALUATIONS = root / "Evaluations" / "Factory"
        for observation in request["observations"]:
            documents = {}
            for ordinal, definition in enumerate(observation["definitions"]):
                target = definition_path(root, ordinal, definition["logicalId"], definition["kind"])
                target.parent.mkdir(parents=True, exist_ok=True)
                data = base64.b64decode(definition["base64"])
                target.write_bytes(data)
                documents[target] = json.loads(data.decode("utf-8"))
            verdict = "rejected"
            ordered = None
            try:
                workflow_path, workflow = compile_factory._find_document(
                    documents, "workflow", observation["workflowId"]
                )
                errors = []
                catalogs = {
                    path: document
                    for path, document in documents.items()
                    if document.get("documentKind") == "capability-catalog"
                }
                capabilities = validate.validate_capability_catalogs(catalogs, errors)
                validate.validate_workflow(workflow_path, workflow, capabilities, errors)
                for phase in workflow["phases"]:
                    compile_factory._validate_stage_zero_phase_scopes(phase)
                if not errors:
                    verdict = "accepted"
                    ordered = compile_factory._topological_order(workflow["phases"])
            except compile_factory.CompilationFailure:
                pass
            response.append({"id": observation["id"], "verdict": verdict, "orderedPhaseIds": ordered})
    sys.stdout.write(json.dumps(response, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        exit_code = main()
    except BaseException:
        sys.stderr.write("")
        raise SystemExit(1)
    raise SystemExit(exit_code)
