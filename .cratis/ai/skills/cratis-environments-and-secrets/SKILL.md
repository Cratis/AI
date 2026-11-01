---
name: cratis-environments-and-secrets
description: Use when a Cratis project needs named environments, per-environment configuration values or secrets with `cratis env` and `cratis config`, or when a Screenplay model's environment keys must be filled. Not for Chronicle server contexts or for authoring the model.
license: MIT
---

# Cratis environments and secrets

A Screenplay model is the same in every environment. What it needs to run (a client id, an SMTP
host, a signing key) is not. A project keeps that in **named environments**, one committed file
per environment next to the model, in the way a Pulumi project has stacks. Which keys a model
needs is derived from its declarations: see
[cratis-screenplay-authentication-and-onboarding](../cratis-screenplay-authentication-and-onboarding/SKILL.md).

**Requires** `cratis` 3.114.0 or later for `cratis env` and `cratis config` (`cratis --version`,
and `which -a cratis` for a shadowing copy). The commands do not exist in older releases.

This is not a Chronicle server context: `cratis context` and `-e/--event-store` on `chronicle`
commands belong to `cratis-chronicle-cli-operations`.

## The secrets contract

This skill applies the always-on [secrets rule](../../rules/secrets.md); read it first. For this
CLI it means:

- **A secret enters only through stdin or the hidden prompt.** Never as an argument (it lands in shell history and the transcript).
- **An agent never runs `cratis config get <key> --show-secret`** and never prints a secret by
  any other route. Without the flag a secret prints as `[secret]`, which is the form to use.
- **An agent does not receive the value to set.** When a secret is needed and the person has not
  provided it through a channel the agent cannot read, ask them to run the `--secret` command in
  their own terminal. Do not ask them to paste it into the chat.
- **A passphrase is not a value to hold.** It comes from `CRATIS_PASSPHRASE`, the file named by
  `CRATIS_PASSPHRASE_FILE`, or the hidden prompt. Never write one to a file in the repository,
  and never export one inline in a command.

## Files and selection

Each environment is `.cratis/environments/<name>.yaml`; a name is a safe file name such as
`development`, `staging` or `customer-x`. Entries are a plain `key: value`, a `secure: <base64>`
secret encrypted by the passphrase provider (safe to commit), or a `ref:` to a vault. The file
never holds a clear-text secret. Read [environment file](references/environment-file.md) for the
exact shape.

The environment in effect is, in order: `--environment <name>` (`-e` on `env` and `config`),
`CRATIS_ENVIRONMENT`, the user's selection in `.cratis/local/selected-environment` (not committed), then
`development`. On Chronicle commands `-e` means `--event-store`; use `--environment` there.

## Commands

```bash
cratis env init                          # creates "development"
cratis env init production --secrets-provider azurekeyvault://<vault>
cratis env select production
cratis env ls
cratis config set auth:clientId <client-id>
cratis config set smtp:password --secret # reads stdin or a hidden prompt
cratis config get smtp:password          # [secret]
cratis config                            # list; secrets show as [secret]
cratis config --missing ./model          # keys the model needs and the environment lacks
```

| Command | Purpose |
|---|---|
| `cratis env init [name]` | Create an environment; `--secrets-provider` picks where secrets live. |
| `cratis env select <name>` / `ls` / `rm <name>` | Select for this user, list (the one in effect is marked), remove (confirms; `--yes` skips). |
| `cratis env change-secrets-provider <uri>` | Move every secret to another provider; the file never holds clear text in between. |
| `cratis env change-passphrase` | Re-encrypt every secret under a new passphrase and salt. |
| `cratis config set <key> <value>` | Set a plain value. |
| `cratis config set <key> --secret` | Set a secret. |
| `cratis config get <key>` / `rm <key>` | Read (secrets masked) / remove (also from the vault). |
| `cratis config [--missing <path>]` | List keys, or the keys a model needs that are absent. |

All accept `-o json`. Exit codes: `0` success, `1` not found, `4` authentication failed (wrong
passphrase), `5` validation, including any key missing under `--missing`.

## Choosing a secrets provider

Default to **passphrase** for a project with one team and a committed environment file. Choose a
vault when secrets must not travel with the repository or are shared with a cluster.

| Provider | Use when | Credentials come from |
|---|---|---|
| `passphrase` (default) | Secrets are committed encrypted (AES-256-GCM, key derived per environment). | `CRATIS_PASSPHRASE`, `CRATIS_PASSPHRASE_FILE` or a prompt. |
| `azurekeyvault://<vault>` | The team already runs Azure Key Vault. | `DefaultAzureCredential` (Azure CLI login, managed or workload identity). |
| `hashivault://<address>/<mount>[/<path>]` | The team runs HashiCorp Vault KV v2. `hashivault+http://` is for a development server. | `VAULT_TOKEN`, or `VAULT_ROLE_ID` and `VAULT_SECRET_ID`, or `VAULT_K8S_ROLE`. |

`cratis run` on a model with `authentication` resolves the selected environment (or `-e <name>`)
before starting Docker, hands the provider and onboarding values to the AuthProxy and Ante
containers, and stops with exit `5` listing the missing keys, never their values. A mail
server is optional: without `onboarding.email.server.host`, emails are written as `.eml` files.
Requires cratis CLI 3.116.0 (`cratis --version`); older CLIs run the Stage alone and play a persona.

## Pitfalls

- Setting a secret with `cratis config set smtp:password <value>` stores a plain value and leaks it. Always add `--secret` and pipe or prompt.
- Committing a `.cratis/local/` folder: it holds the personal selection and is git-ignored by `cratis init` and `cratis env select`.
- Wrong passphrase is exit `4` before anything is decrypted; do not retry it in a loop.
- `cratis config --missing` on a model that does not compile exits `5` and names the first errors; fix the model first.
- A key added to the model later is missing from existing environments; re-run `--missing` per environment.

## Verify

1. `cratis env ls` marks the environment you intend; `cratis config -e <name>` lists the expected keys.
2. `cratis config --missing <model-folder> -e <name>` exits `0` (`echo $?`).
3. `git diff` on `.cratis/environments/` shows only plain values, `secure:` or `ref:` entries, and no clear-text secret.
4. No command in the session used `--show-secret`, and no secret appears in the transcript.

## Route near misses

- Chronicle server contexts and operations: `cratis-chronicle-cli-operations`.
- The model's `authentication` and `onboarding` blocks and their keys: `cratis-screenplay-authentication-and-onboarding`.
- Running the application with the resolved values: `cratis-onboarding-runtime` (cluster) and `cratis-stage-rendering-and-sandbox`.
