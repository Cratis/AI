# Cratis AI release requests

A release pull request adds exactly one immutable request named
`v<exact-semver>.json` to this directory and includes every catalog/profile/source
approval required by that request.

Pull-request validation generates all requested profile artifacts. Merging the
release PR to `main` is the recurring human release approval and triggers:

1. generated distribution and GitHub release assets;
2. npm trusted publication;
3. required canaries;
4. automatic promotion or rollback;
5. subscriber update pull requests;
6. automatic marketplace updates where supported and submission preparation
   where a vendor requires human review.

External App credentials, npm trusted-publisher registration, initial canary
scope, and one-time vendor account/listing approvals are tracked in AI#181.

Do not add a request until its profiles are fully approved. Release request files
are append-only and version-unique.
