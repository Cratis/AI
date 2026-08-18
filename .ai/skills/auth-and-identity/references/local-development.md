# Local Development & Testing

This reference covers simulating authentication and identity in local development environments without real Azure or identity infrastructure.

## How Identity Works in Development

When running locally:

1. No Azure App Service or ingress injects identity headers
2. The `.cratis-identity` cookie will not be set automatically
3. The frontend cookie reader falls back to calling `GET /.cratis/me`
4. The backend returns a default anonymous identity with empty details

## Generating a Microsoft Client Principal

Arc deserializes the **Azure Static Web Apps** client-principal shape, not App Service Easy Auth's. The two are different schemas — Easy Auth's `auth_typ` / `name_typ` / `role_typ` envelope deserializes into an all-empty `ClientPrincipal` and gets you nothing.

**All three headers are required.** `MicrosoftIdentityPlatformAuthenticationHandler` returns `AuthenticationResult.Anonymous` unless every one of them is present:

| Header | Carries |
|---|---|
| `x-ms-client-principal` | base64 of the JSON below |
| `x-ms-client-principal-id` | the user id — becomes the `nameidentifier` and `sub` claims |
| `x-ms-client-principal-name` | the user name |

### Step 1: Build the Principal JSON

Property names are camelCase (Arc's `JsonSerializerOptions` use an acronym-friendly camelCase policy); claim entries keep Azure's short `typ` / `val` names:

```json
{
    "identityProvider": "aad",
    "userId": "user-unique-id",
    "userDetails": "Jane Developer",
    "userRoles": ["Admin", "Manager"],
    "claims": [
        { "typ": "http://schemas.microsoft.com/identity/claims/objectidentifier", "val": "user-unique-id" }
    ]
}
```

`userRoles` becomes the `ClaimTypes.Role` claims the authorization evaluator matches `[Roles(...)]` against. `userDetails` becomes `ClaimTypes.Name`. Any `nameidentifier` / `sub` / identity-provider claims you put in `claims` are stripped and re-derived from the headers, so don't bother setting them.

### Step 2: Base64-Encode It

**macOS / Linux terminal:**

```bash
echo -n '{"identityProvider":"aad","userId":"user-unique-id","userDetails":"Jane Developer","userRoles":["Admin","Manager"],"claims":[]}' | base64
```

**Browser console:**

```javascript
btoa(JSON.stringify({
    identityProvider: 'aad',
    userId: 'user-unique-id',
    userDetails: 'Jane Developer',
    userRoles: ['Admin', 'Manager'],
    claims: []
}));
```

### Step 3: Inject All Three Headers

Use the [ModHeader](https://modheader.com/) browser extension:

1. Install ModHeader for Chrome/Edge/Firefox
2. Add three request headers:
   - `x-ms-client-principal` → the base64 string from Step 2
   - `x-ms-client-principal-id` → `user-unique-id`
   - `x-ms-client-principal-name` → `Jane Developer`
3. Reload the page — the backend authenticates the user as if the platform injected the headers

Setting only `x-ms-client-principal` leaves you anonymous with no error; a *present but malformed* principal fails the request instead, which is how you tell the two mistakes apart.

## Custom Identity Details in Development

If your `IProvideIdentityDetails<TDetails>` implementation enriches identity from a database, that still runs in development. The principal provides the initial `id`, `name`, and `roles`; your enrichment adds extra fields.

To test without a database, create a dev-only fallback in your identity provider:

```csharp
public record UserDetails(string Department, string Title);

public class IdentityDetailsProvider(IMongoCollection<User> users) : IProvideIdentityDetails<UserDetails>
{
    public async Task<IdentityDetails> Provide(IdentityProviderContext context)
    {
        var user = await users.Find(u => u.ExternalId == context.Id.Value).FirstOrDefaultAsync();

        // No record for this developer yet — fall back to sensible defaults
        var details = user is null
            ? new UserDetails("Engineering", "Developer")
            : new UserDetails(user.Department, user.Title);

        return new IdentityDetails(true, details);
    }
}
```

`Provide` always returns `Task<IdentityDetails>` — the `IdentityDetails(bool IsUserAuthorized, object Details)` wrapper, never the details record on its own.

## Testing Without ModHeader

If you prefer not to install a browser extension, you can also set the cookie directly:

1. Build the identity JSON matching the `.cratis-identity` cookie format
2. Set it via browser console:

   ```javascript
   document.cookie = '.cratis-identity=' + btoa(JSON.stringify({
       id: 'user-id',
       name: 'Jane Developer',
       roles: ['Admin'],
       details: { department: 'Engineering' }
   })) + '; path=/';
   ```

3. Reload — the frontend will use this cookie directly without calling the backend

## Important Notes

- The cookie is `HttpOnly=false` by design — the frontend JavaScript must read it
- The cookie path is `/`
- In production, the cookie is set by the backend middleware; in development, you can set it manually
- The `GET /.cratis/me` endpoint always works — it is the fallback for all environments
- ModHeader header injection simulates the full pipeline (authentication → identity provider → cookie), while direct cookie setting bypasses the backend entirely
