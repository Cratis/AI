# Enforce admission at the server in Go

With authenticated principals in the host, add `commands.WithAuthorization[Rename](metadata.Authorization{})` to the registration of a `Rename` command. The explicit empty declaration requires sign-in. For named policies, register an evaluator covering the same declarations before building the catalog. Run through Arc without credentials and then with an allowed principal; inspect `IsAuthorized` and confirm only the allowed invocation writes.

`MicrosoftIdentityPlatform` does not validate JWTs. Enable `TrustForwardedIdentityHeaders` only behind an authenticating ingress that replaces caller-supplied headers and cannot be bypassed. `RegisterIdentityDetails` and `RegisterScopedIdentityDetails` supply additional identity information, not authorization policy.
