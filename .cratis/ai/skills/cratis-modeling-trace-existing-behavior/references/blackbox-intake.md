# Reconstruct from black-box evidence

Bound the intake by application/build, actor and journey. Take only approved artifacts; use a local, isolated instance with synthetic data and disposable state for authorized probes. Never replay captured traffic against the original endpoint. Assign each sanitized artifact or observation an evidence ID and a locator (version, frame, request or document section). Keep original material in approved storage; redact before copying, quoting or sharing it.

| Source | Extract and sanitize |
| --- | --- |
| Shipped app, installer or bundle | Record build, entry point and observable inputs and results. Inspect or run only authorized artifacts in isolation; redact bundled configuration and environment details. |
| HAR or request capture | Preserve method, path shape, field types, status, order and causality. Strip cookies, tokens, auth headers and personal values in URLs, headers and bodies; replace IDs consistently so joins and repeats remain testable. |
| OpenAPI | Record operation, request/response shape, statuses and declared security. Remove private hosts, credential examples and personal payloads. A declared contract is not a captured run. |
| Screenshot or recording | Record frame, actor action and visible transition. Crop or redact names, identifiers and private screens; don't infer persistence from a matching row. |
| Documents | Record requirements and examples with section locators. Exclude restricted and personal text; distinguish asserted policy from observed behavior. |

For each journey, record evidence IDs, input and prior state, observed result, inferences and unknowns. Have the owner mark it **keep**, **change** or **remove**; give changed journeys an explicit new expectation rather than claiming fidelity. In an authorized rebuilt target, reset only disposable fixtures and replay kept cases with the same sanitized inputs and state: success, refusal, malformed request and repeat where applicable. Check responses, visible results and state effects (including no write or duplicate where expected). Map each evidence ID and case to **passed**, **failed** or **untested**, with check and result; note missing observability. A matching screenshot alone does not close a behavior row.
