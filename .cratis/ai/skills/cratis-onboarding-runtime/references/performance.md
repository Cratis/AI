# Performance resource

```yaml
apiVersion: showrunner.cratis.io/v1alpha1
kind: Performance
metadata:
  name: crm
  namespace: apps
spec:
  productionRef:
    name: ledger
  chronicle:
    connectionSecretRef:
      name: chronicle-connection
  application:
    image: registry.example.com/crm:1.0.0
    eventStores: [Crm]
  environment:
    name: production
    configMapRef:
      name: crm-environment
    passphraseSecretRef:
      name: crm-passphrase
  authProxy:
    enabled: true
    providers:
      - kind: EntraId
        identity: EntraId
  onboarding:
    enabled: true
    signUp: CreateTenant
    personas: [Administrator, Member]
    legal:
      configMapRef:
        name: crm-legal
  ingress:
    enabled: true
    className: nginx
    hosts: [crm.example.com]
    tlsIssuer:
      name: letsencrypt
```

## Fields that decide behavior

- Chronicle: `chronicle.connectionSecretRef` (an existing Secret) takes precedence over `productionRef`. The Secret is mounted as a file, never copied. `application.eventStores[0]` is the store Ante observes.
- `environment.configMapRef` holds `<name>.yaml` unless `key` says otherwise. `passphraseSecretRef` is only for a passphrase environment. Azure Key Vault uses the operator's workload identity; HashiCorp Vault uses Kubernetes auth with the operator's service account and `VAULT_K8S_ROLE`; both are chart values.
- `authProxy.providers` carry kind and identity only, matching the model. `onboarding` carries `signUp`, `personas` and legal files; every value comes from the environment.
- `onboarding.attestedProviders` set: Ante runs attested invitation exchange against AuthProxy's attestations; unset keeps the legacy exchange.

## Created resources (for a Performance named `crm`)

| Resource | Name | Notes |
|---|---|---|
| Deployment and Service | `crm-app`, `crm-authproxy` (when enabled), `crm-ante` (when onboarding) | ClusterIP; Ante has one replica. |
| Ingress | `crm` | Every host routes to AuthProxy only; certificate from cert-manager. |
| Secrets | `crm-app-environment`, `crm-authproxy-environment`, `crm-ante-secrets`, `crm-signing-keys` | Mounted content and generated keys. |

AuthProxy gets one file per environment key it needs in `/run/secrets/cratis`; Ante gets one file
per setting (`__` for `:`) in `/run/secrets/ante`; the application gets the remaining keys in
`/run/secrets/cratis`. Pods roll when mounted content changes, via a keyed hash annotation that
reveals nothing about a value. Ante's own MongoDB server comes from the environment key `ante.mongodb.server`.

## Status

| Field | Meaning |
|---|---|
| `phase` | `Pending`, `Blocked`, `Progressing` or `Ready`. |
| `publicUrl` | `https://` and the first ingress host. |
| `missingEnvironmentKeys` | Keys the environment lacks while `Blocked`. |
| `conditions` | `SpecValid`, `ChronicleConnection`, `EnvironmentResolved`, `EnvironmentComplete`, and per component `ApplicationReady`, `AuthProxyReady`, `AnteReady`. |
| `signingKeys` | Key ids in use, rotation counter applied, previous public keys pinned. |

Conditions and status never contain a secret value. An unresolved environment is reported in
`EnvironmentResolved` with a message naming the key and the provider.

## Signing keys

The operator generates the key Ante signs invitations with and the key AuthProxy signs
attestations with, in `crm-signing-keys`. Raise `spec.signingKeys.rotation` to rotate both. The
public half of each replaced key stays pinned (`signingKeys.retainPrevious`, two by default), so
Ante verifies invitations signed with a previous key.

Routing `/_invite` and `/.well-known/ante` from AuthProxy to Ante is configured on AuthProxy's
side; set `onboarding.lobbyBackendBaseUrl` in the environment when needed. Other Stage Manager
resources (`Production`, `Understudy`, `Restore`, `Rehearsal`, `BackstagePass`, `ControlRoom`) are schema only; nothing acts on them.
