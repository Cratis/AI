# Ante onboarding keys

Configuration keys under `Ante:Onboarding:` when `Enabled` is `true`. Each value maps onto the
ordinary key shown and wins over it. In environment-variable form use `__` for `:`.

| Key | Type | Maps to | Notes |
|---|---|---|---|
| `Enabled` | bool | none | Applies the contract. Default `false`. |
| `HostStore` | string | `Ante:HostStores` (one entry) | The application's own Chronicle store. Required unless development mode (then `Application`). |
| `EventStore`, `Namespace` | string | `Ante:EventStore`, `Ante:Namespace` | Optional. Ante's own store and fixed namespace. |
| `PublicBaseUrl` | absolute URL | `Ante:Invitations:Token:PublicBaseUrl` | Where users reach this Ante. HTTPS, or HTTP on loopback. |
| `ApplicationUrl` | URL | `Ante:HostAppUrl` | Where people go when onboarding completes. |
| `SignUp` | `CreateTenant` or `JoinTenant` | `Ante:Registration:Enabled` | `JoinTenant` closes `/register`. |
| `RegistrationEnabled` | bool, default `true` | `Ante:Registration:Enabled` | Always off when `SignUp` is `JoinTenant`. |
| `InvitationTypes` | list | none (runtime check) | `JoinTenant`, `CreateTenant`; unset allows both. |
| `Personas` | list | none (runtime check) | Grantable personas; ordinal comparison; unset or empty accepts any role. |
| `DefaultLocale`, `AllowedLocales` | string, list | `Ante:DefaultLocale`, `Ante:SupportedLocales` | |
| `Legal:Folder`, `Legal:TermsAndConditions`, `Legal:PrivacyPolicy` | paths | `Ante:Legal:Source=Files`, `Ante:Legal:Files:*` | Omit `Legal` for no legal step. |
| `Secrets:Path` | folder | any key | One file per setting, named like the key with `__` for `:`; trailing newline removed; names starting `.` skipped. |
| `Secrets:SigningKeyFile` | file path | `Ante:Invitations:Token:PrivateKeyPem` | PEM RSA private key, at least 2048 bits. |
| `Secrets:VerificationKeyFile` | file path | `Ante:Invitations:Token:PublicKeyPem` | Optional extra trusted public key. |
| `Development:Enabled`, `Development:DataPath` | bool, folder | none | Local runs only; see `SKILL.md`. |

The same instance still needs `Cratis:Chronicle:ConnectionString` and `Cratis:MongoDB`, normally
supplied by the Cratis environment. Attested-exchange settings, `Issuer`, `Audience` and `Expiry`
stay under `Ante:Invitations`.

Legal terms from files: the version is `sha256-` plus the first 16 hex characters of a SHA-256
over both bodies. The set is read on every request, so a changed mounted file applies without a
restart. Acceptance is recorded and published as `LegalTermsAccepted` carrying that version; Ante
does not publish `LegalDocumentSetActivated` for a file set.
