# Authorization

This reference covers protecting commands and queries with authorization attributes.

## Attributes

Arc uses its own authorization attributes from `Cratis.Arc.Authorization` — these are **distinct from ASP.NET Core's** and are evaluated by `AuthorizationEvaluator` in the command/query pipeline.

| Attribute | Purpose |
|-----------|---------|
| `[Authorize]` | Require authentication. Set `Roles` to require roles. |
| `[Roles(nameof(Role.Admin), nameof(Role.Manager))]` | Convenience wrapper — user needs at least **one** of the listed roles. |
| `[AllowAnonymous]` | Bypass authorization. Useful with fallback policies. |

> **`AuthorizeAttribute.Policy` is inert.** Arc's `AuthorizationAttributeEvaluator` reads only `Roles` off the attribute; nothing in Arc ever reads `Policy`. `[Authorize(Policy = "...")]` compiles and then silently authorizes nobody in particular — see *Policy-based authorization* below.

### Always `nameof`, never a string literal

Analyzer **ARC0011** flags a string-literal `[Roles]` argument. It is a **Warning**, and under the repo's zero-warning gate a warning fails the build — so a literal is not a style preference, it breaks CI. A rename would otherwise silently desynchronize the attribute from the role definition, leaving the endpoint locked or matching a stale role.

Declare roles once and reference them with `nameof`:

```csharp
public enum Role
{
    Admin,
    Editor,
    Manager
}
```

## On Model-Bound Commands

```csharp
[Command]
[Roles(nameof(Role.Admin), nameof(Role.Editor))]
public record DeleteArticle(ArticleId Id)
{
    public void Handle(IArticleService articles) => articles.Delete(Id);
}
```

When authorization fails, `Handle()` is **never called**. Check `CommandResult.IsAuthorized`:

```csharp
var result = await commandPipeline.Execute(new DeleteArticle(articleId));
if (!result.IsAuthorized)
{
    // User lacked required role — command was not executed
}
```

## On Model-Bound Queries

Authorization applies at both class and method level:

```csharp
[ReadModel]
[Authorize]
public record DebitAccount(AccountId Id, AccountName Name, decimal Balance)
{
    [Roles(nameof(Role.Admin))]
    public static IEnumerable<DebitAccount> AllAccounts(
        IMongoCollection<DebitAccount> collection) =>
        collection.Find(_ => true).ToList();

    [Roles(nameof(Role.Manager))]
    public static IEnumerable<DebitAccount> HighValueAccounts(
        IMongoCollection<DebitAccount> collection) =>
        collection.Find(a => a.Balance > 50000).ToList();
}
```

Every query method must return the read-model type or a collection of it, so a `static int GetTotalCount(...)` on this record is not a query at all — Arc will not discover it and no endpoint appears.

## Inheritance Rules

| Scenario | Result |
|----------|--------|
| `[Authorize]` on type | All methods require authentication |
| `[Roles]` on type | All methods require those roles |
| `[AllowAnonymous]` on type | All methods allow anonymous access |
| Method-level attribute present | **Overrides** type-level attribute |
| Both `[Authorize]` and `[AllowAnonymous]` on same target | **Error** — throws `AmbiguousAuthorizationLevel` |

Method-level always takes precedence:
- Methods **without** authorization attributes inherit the class-level attribute
- Methods **with** `[Roles(...)]` override the class-level attribute
- Methods **with** `[AllowAnonymous]` completely bypass authorization

## Fallback Policy (Secure by Default)

Make all endpoints require authentication unless explicitly opted out:

```csharp
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());
```

With this, use `[AllowAnonymous]` to make specific endpoints public:

```csharp
[Command]
[AllowAnonymous]
public record GetPublicCatalog()
{
    public Catalog Handle(ICatalogService catalog) => catalog.GetPublic();
}
```

### Default Policy vs Fallback Policy

| Policy | Applied When |
|--------|-------------|
| **Default Policy** | `[Authorize]` is used without parameters |
| **Fallback Policy** | No authorization attribute is present at all |

## Policy-Based Authorization — not supported by Arc's evaluator

**Do not use `[Authorize(Policy = "...")]` on a `[Command]` or `[ReadModel]`.** `AuthorizeAttribute` declares a `Policy` property, but Arc's `AuthorizationAttributeEvaluator` returns only `(HasAuthorize, Roles)` — the policy name is never read, so the attribute degrades to a bare "must be authenticated" and the policy silently never runs.

Express the same rules with what Arc *does* evaluate:

- **Roles** — `[Roles(nameof(Role.Admin))]`, evaluated per command/query.
- **Cross-cutting rules** — an `ICommandFilter` (see below), which sees the whole `CommandContext`.
- **Command-specific rules** — a `CommandValidator<T>`, or a typed rejection from `Handle()`.

ASP.NET Core policies still apply to *ASP.NET* endpoints (a fallback policy on the pipeline, for instance); they just do not reach Arc's model-bound artifacts through `[Authorize(Policy = …)]`.

## Custom Authorization Logic in a Command

`CommandContext` carries `CorrelationId`, `Type`, `Command`, `Dependencies`, `Values`, `AllowedSeverity`, `Response`, `ServiceProvider`, and `CancellationToken` — **there is no `context.User`**. Read the current principal through `ICurrentPrincipalAccessor`, which is transport-independent (HTTP request principal, or the principal from a server-side execution scope).

There is also **no `CommandResult.Forbidden`**. The factory methods are `Success`, `Unauthorized`, `MissingHandler`, `Error`, `InvalidBody`, and `FromException`. Ownership checks are a business rejection, so express them as a validation result rather than an authorization one:

```csharp
[Command]
[Authorize]
public record UpdateOrder(OrderId Id, OrderData Data)
{
    public async Task<Result<OrderUpdated, ValidationResult>> Handle(
        IOrderRepository orders,
        ICurrentPrincipalAccessor principalAccessor)
    {
        var userId = principalAccessor.Current?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var order = await orders.GetById(Id);

        if (order.OwnerId != userId)
        {
            return ValidationResult.Error("You can only update your own orders.");
        }

        return new OrderUpdated(Data);
    }
}
```

Use `CommandResult.Unauthorized(context.CorrelationId)` only from an `ICommandFilter`, where you are producing the result envelope directly.

## Authorization Results

| Scenario | HTTP Status |
|----------|-------------|
| Not authenticated | 401 Unauthorized |
| Authenticated but wrong role | 403 Forbidden |

## Cross-cutting authorization — `ICommandFilter`

When the same authorization rule must span many commands (e.g. every command under a namespace), don't repeat it per handler — implement an `ICommandFilter` (auto-discovered, runs before the handler):

```csharp
public class AdminAreaFilter : ICommandFilter
{
    public Task<CommandResult> OnExecution(CommandContext context) =>
        Task.FromResult(context.Type.Namespace?.Contains(".Admin.") == true && !IsAdmin(context)
            ? CommandResult.Unauthorized(context.CorrelationId)
            : CommandResult.Success(context.CorrelationId));
}
```

Reserve attributes for per-command roles; use `ICommandFilter` for the cross-cutting rule. Command-specific *scope* rejection ("may only act on your own organization") still belongs in the `CommandValidator<T>`.

## ⚠️ Adding `[Roles]` breaks existing specs

Adding `[Roles]` to an existing command **breaks all its `.Execute()` specs** — both happy-path and validation-failure. An unauthorized result has `IsSuccess == false`, so `ShouldNotBeSuccessful()` still passes but the result carries **no** validation errors, so `ShouldHaveValidationErrors()` silently flips to failing. Register the identity the authorization evaluator reads into the command scenario's `Services`, and assert auth failures with `ShouldNotBeAuthorized()` — never `ShouldNotBeSuccessful()` alone.
