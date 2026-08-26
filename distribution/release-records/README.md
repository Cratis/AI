# Append-only release records

This directory is intentionally empty while S10 is blocked.

Future records are immutable and append-only. They progress through separate
preflight, request, authorized-candidate, publication, promotion, and support
records. A later receipt never rewrites an earlier record, and no
prepublication gate requires a receipt that can exist only after publication.

The release request references a deterministic preflight digest computed from
prerequisites already present on its base. The request PR's named review and
two-parent merge commit are captured afterward as the authorized-candidate
attestation.
