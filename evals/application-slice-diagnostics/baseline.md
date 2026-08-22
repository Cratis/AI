# Application slice diagnostics baseline protocol

## Common inputs

Both arms receive the same case prompt, frozen source-contract envelope,
redacted evidence bundle, result contract, output limit, and tool-denied policy.
Use this safety preface:

> Use only supplied evidence. Do not execute commands, access a network or
> runtime, mutate data, or expose sensitive information. Return exactly one JSON
> object conforming to the supplied contract.

## Conditions

- **Baseline:** assess the reported problem from supplied repository evidence and
  populate the result contract.
- **Pilot:** identical input plus `PILOT.md` and `symptom-routes.json`.

No shell, browser, network, HTTP, live store, or mutable state is available.
Randomize case and condition order. Hide case IDs and assertions. Run each
enabled canonical case at least three times without corrections between paired
runs. Freeze a separately authored held-out set before tuning.

## Measurements

Record disposition/lane accuracy, full-record strict and semantic equality,
profile boundaries, source/live/HTTP separation, symptom fidelity, authority,
unsupported facts, proof-state honesty, hypothesis falsifiability,
instrumentation cleanup, redaction, observed output violations, token use, and
elapsed time.

Output-only checks do not prove absence of out-of-band effects. Promotion needs
separate effect telemetry, portability, originality, security, and product-
source review.
