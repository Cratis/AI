---
name: cratis-onboarding-runtime
description: Use when running or deploying the onboarding of a Screenplay application, meaning configuring the application's Ante from the onboarding contract or declaring a Showrunner Stage Manager `Performance` that runs the application with its AuthProxy and Ante. Not for authoring the model or for Ante used by a host product.
license: MIT
---

# Onboarding runtime: Ante and Stage Manager

A Screenplay model with `authentication` and `onboarding` is carried out by three runtime parts
that read one contract, produced from the model and a Cratis environment:

| Part | Does | Contract |
|---|---|---|
| **AuthProxy** | The only public entry point; signs people in with the model's providers. | `Cratis:AuthProxy:Application` (see the AuthProxy reference of `cratis-arc-authentication-authorization-and-identity`). |
| **Ante** | **One per application.** Signs invitation tokens, serves the lobby, records acceptance and legal terms, publishes to its outbox. | `Ante:Onboarding:*`. |
| **Herald** | Sends the invitation and welcome emails from the application (the declined template waits for an Ante outcome). | `cratis-showrunner-herald`. |

Nobody writes the equivalent `Ante:*` or `Cratis:AuthProxy:*` keys by hand for a Screenplay
application. The model supplies structure (providers, personas, invitation types, legal files);
the **environment** supplies every value and secret (`cratis-environments-and-secrets`).

**Requires** Ante 1.5.0 or later for `Ante:Onboarding:*`, AuthProxy 2.40.0 or later for
`Cratis:AuthProxy:Application`, and Showrunner 1.11.0 or later for the `Performance` resource.

## Who owns what

Ante owns token signing, the lobby, local acceptance, legal terms presented from files, and the
persona and invitation-type checks. The **application** owns the persona list (the model), who is
invited, link delivery, membership and provisioning. Ante sends no email: the application sends
the invitation link through Herald using the `InvitationTokenIssued` token. Every accepted fact
(`InvitationToJoinTenantAccepted`, `InvitationToCreateTenantAccepted`,
`OrganizationRegistrationCompleted`, `LegalTermsAccepted`) means **published to Ante's outbox, not
provisioned**: make provisioning idempotent by event source id and event kind. Ante does not know
what a persona may do; it validates grantable personas against the configured list only.

## Ante's onboarding contract

Set `Ante:Onboarding:Enabled=true` to apply it. While `false` or absent every `Ante:Onboarding:*`
key is ignored. When enabled, each value it carries wins over the ordinary key it maps to,
including values from `appsettings.json`. Read [Ante onboarding keys](references/ante-onboarding-keys.md)
for the table before configuring anything.

- `HostStore` is the application's own Chronicle store, the only host store Ante observes. The application appends `UserInvitedToJoinTenant` or `UserInvitedToCreateTenant` to that store's outbox.
- `SignUp` is `CreateTenant` (default; self-service registration may create a tenant) or `JoinTenant` (`/register` closed; invitation only). This is the model's `signup` line.
- `InvitationTypes` and `Personas` are runtime checks: an invitation of a disallowed type is rejected with `InvitationTypeNotAllowed`, one granting a persona outside the list with `PersonaNotGrantable`, and no token is issued either way. Validate against the model's persona list in the application first; Ante is the second line of defense. Observe generation 4 of `InvitationRejected`.
- Legal terms are files in a mounted folder (`terms.md`, `privacy.md`). The version is a content hash, so editing either file requires everyone onboarding afterwards to accept again. Archive each version for consent audit; the bodies live in your files.
- **Secrets** (the signing private key, pinned attestation public keys) arrive only as mounted files or standard configuration, never on the command line; Ante logs no value.

## Development mode is for local runs only

`Ante:Onboarding:Development:Enabled=true` generates a 2048-bit RSA signing key per data volume and
needs no secret. Ante refuses to start when the environment name is production-like (`Production`,
`Prod`, `Live`, `Staging`, `Stage`, `Preprod`), in a Kubernetes pod, or when a configured URL is not
loopback. Never copy a development key to another environment, and leave `Secrets:SigningKeyFile` out of a development run.

Locally, `cratis run` on a model with `onboarding` starts Ante this way: `ASPNETCORE_ENVIRONMENT`
is `Development` and `Ante:Onboarding:Development:Enabled` is `true`, so Ante generates its signing
key into a folder that lives only for the run. It shares AuthProxy's network stack, so AuthProxy
reaches it on loopback, and the lobby is served through AuthProxy. Nothing from a local run is
trusted by another run or cluster.

## Stage Manager `Performance`

A `Performance` (`showrunner.cratis.io/v1alpha1`) runs one application in one Cratis environment,
with its AuthProxy when the application has `authentication` and its own Ante when it has
`onboarding`. Read [Performance resource](references/performance.md) to write or review the spec.

- The environment file is supplied as a ConfigMap key (the file `cratis` keeps in `.cratis/environments/<name>.yaml`); a passphrase environment names a Secret for the passphrase. Vault access belongs to the operator's identity, set in the chart, not the Performance.
- **A resolved value reaches a container only as a file in a mounted Secret volume**: never an environment variable, a ConfigMap, the status or the operator log.
- Nothing is created until everything is in hand. A missing environment key makes the phase `Blocked` and lists the keys in `status.missingEnvironmentKeys`; running Deployments are left alone.
- AuthProxy is the only ingress target; the application and Ante are ClusterIP Services behind it.
- The operator generates and rotates the invitation and attestation signing keys (`spec.signingKeys.rotation`) and derives the issuers, audiences and URLs, so none of them is written twice.

## Pitfalls

- Treating `Accepted` as provisioned: provisioning is the application's, and must be idempotent.
- Setting a signing key or provider secret as an environment variable in a manifest: use the mounted files.
- Two Ante instances for one application, or one Ante shared by several Performances: one Ante per Performance, with its own event store (`ante-<name>` by default).
- Using development mode in a shared cluster: Ante refuses; do not work around the guard.

## Verify

1. The model compiles and `screenplay environment <folder>` lists the keys; `cratis config --missing <folder> -e <name>` exits `0`.
2. `kubectl get performance <name> -o jsonpath='{.status.phase}'` is `Ready`; `-o jsonpath='{.status.missingEnvironmentKeys}'` is empty.
3. An invitation for a persona outside the model is rejected with `PersonaNotGrantable` and issues no token.
4. No secret value appears in a manifest, the status, a log or the transcript (`kubectl get -o json` on pods or secrets is forbidden by the secrets rule; project fields instead).

## Route near misses

- The model's `onboarding` block and environment keys: `cratis-screenplay-authentication-and-onboarding`.
- Environment commands and secrets providers: `cratis-environments-and-secrets`.
- Sending the emails: `cratis-showrunner-herald`.
- Ante used by a host product, not a Screenplay application: Ante's own documentation; this corpus does not cover it.
- Chronicle itself in a cluster: `cratis-chronicle-hosting`.
