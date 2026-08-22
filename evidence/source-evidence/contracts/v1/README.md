# Source evidence contract v1

This directory defines the normative, repository-evaluation-only admission
boundary for future first-party source evidence.

`policy.json`, `contract-files.json`, and every file under `schemas/` are
normative. `contract-files.json` binds their exact canonical bytes. The contract
revision is the SHA-256 digest of canonical `contract-files.json` and is not
stored inside that file.

This revision contains no evidence bundle, source body, excerpt, derivative,
attestation, verification, redaction review, admission, revocation, proof,
model run, runtime artifact, package, publication, or case activation.

The current registry is `CONTRACT_ONLY`. A structurally valid candidate is not
admitted evidence, and accepted repository evidence would still require a
separate case-activation change.
