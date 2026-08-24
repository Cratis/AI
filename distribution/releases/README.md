# Cratis AI release requests

A release pull request adds exactly one immutable request named
`v<exact-semver>.json` to this directory and includes every catalog/profile/source
approval required by that request.

Pull-request validation generates all requested profile artifacts. Merging the
release PR to `main` is the recurring human release approval and triggers:

1. exact generated distribution candidates;
2. required pre-publication canary and checksum verification;
3. a draft GitHub release and unmerged distribution index pull request;
4. one exact npm profile publication; and
5. GitHub release promotion plus index auto-merge only after npm succeeds.

The current implementation cleans up unpublished draft state automatically. It
does not claim to roll back an immutable npm version. Subscriber updates and
marketplace delivery remain disabled handoffs until Workflows#73 and AI#147
complete their implementation, canary, and account gates.

External App credentials, npm trusted-publisher registration, initial canary
scope, and one-time vendor account/listing approvals are tracked in AI#181.

Do not add a request until its profile is fully approved. One request contains
one profile until atomic multi-package npm publication exists. Request automation
must exactly match `distribution/release-automation-capabilities.json`. Release
request files are append-only and version-unique.
