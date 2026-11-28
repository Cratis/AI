# Present the current caller

In a React component use `useIdentity(DetailsType, defaultDetails)` from `@cratis/arc.react/identity`. Pass the real details class and an instance of it with safe typed defaults, including an explicit missing state for any detail the UI needs. For example, default an optional display name to `undefined`, not a fabricated name. An authenticated caller can have no details; the fallback is used as-is, not hydrated.

Check `isLoading` first; show pending rather than flashing sign-in or denial. Once resolved, check `isSet` for a signed-in caller, then check the needed detail before rendering it. Do not infer that the user is signed in from a populated default. Sign in and out through the real identity provider. Only a missing identity endpoint (404) permits cookie fallback; 401 or 403 is not a reason to reuse a cached identity.

For a role-only affordance, use `RequireRole` from the same package, with e.g. `roles={['catalog-editor']}`, a `whileLoading` placeholder and distinct `forbidden` content. This is presentation only; authorize commands and queries on the server. In a bound view model, inject `IIdentityProvider` from `@cratis/arc/identity` instead of calling React hooks.
