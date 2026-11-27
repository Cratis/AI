# Environment file

```yaml
secretsProvider: passphrase
encryptionSalt: <base64>
encryption:
  kdf: pbkdf2-sha256
  iterations: 600000
  check: <base64>
config:
  auth:clientId: <client-id>
  smtp:host: mail.example.com
  smtp:password:
    secure: <base64>
  signing:key:
    ref: <vault reference>
```

| Entry | Meaning |
|---|---|
| `key: value` | A plain value. |
| `key: { secure: <base64> }` | A secret encrypted by the passphrase provider; bound to its key, so moving the ciphertext to another key fails. Safe to commit. |
| `key: { ref: <name> }` | A secret kept in Azure Key Vault or HashiCorp Vault. The file holds only the reference. |

`secretsProvider`, `encryptionSalt` and `encryption` describe where secrets live. The salt is per
environment, so two environments with one passphrase get different ciphertext. Do not edit these
fields by hand; use `cratis env change-passphrase` or `change-secrets-provider`.

## Vault storage

- Azure Key Vault: secrets named `cratis-<environment>-<key>` with a short hash suffix; the file holds the name as `ref:`.
- HashiCorp Vault: KV v2 at `<path>/<environment>/<key>` (the path defaults to `cratis`); the file holds that path as `ref:`.
- `VAULT_AUTH_MOUNT` overrides the auth method mount and `VAULT_NAMESPACE` sets the Vault namespace.

## Reading environments from code

The `Cratis.Environments` package reads the same files, so other tools resolve values and
secrets exactly as the CLI does.

```csharp
var environments = ProjectEnvironments.Discover(Directory.GetCurrentDirectory());
var selected = environments.Resolve(explicitName: null);
var environment = ProjectEnvironment.Open(environments, selected.Name, PassphraseSources.FromEnvironment());

var clientId = await environment.GetValueAsync("auth:clientId");
```

Keep a resolved secret in memory only; never log it or write it to a file the repository tracks.
