# Default offering

Requires Showrunner 1.13.0 or later (`Cratis.Showrunner.BoxOffice`) for `DefaultOffering`,
`IDefaultOffering` and an event store taken from the host. Older releases have neither.

A product that sells itself starts a new tenant on its default offering without waiting for the
operator. The product decides, the operator is told, and a later operator decision replaces it.

## Declare it

```csharp
builder.Services.AddBoxOfficeOffering(offering => offering
    .Product(productId)
    .Seats(SeatLicensing.PerUser)
    .DefaultOffering("Starter"));
```

The name is the offer in the operator's catalog. The declaration is reported once per change as
`DefaultOfferingDeclared`, so the operator knows which offer new tenants start on. A declaration
that cannot be sold throws `InvalidOffering` at startup, one sentence per problem.

## Start a tenant

Call `IDefaultOffering.StartTenant(tenant, organization)` when the product has created the tenant.
It finds the named offer among the offers the operator published and does two things:

- records `TenantStartedOnDefaultOffering` in the tenant's own stream, so the tenant has the offer's
  included seats and modules at once, with no trial;
- publishes `TenantStartedOnOffer` to the operator, with the offer's name, included seats and
  modules.

A later operator decision such as `SeatCapacitySet` or `ModuleRevoked` supersedes what the tenant
started with: the newest decision wins.

## Failures

| Failure | Meaning | Action |
|---|---|---|
| `DefaultOfferingNotDeclared` | The product declared no default offering. | Add `DefaultOffering(...)`. |
| `DefaultOfferingNotPublished` | The operator has not published an offer with that name, or withdrew it. The name compares ignoring case. | Publish the offer; retry. |
| `TenantNotStarted` | The tenant could not be started. | Read the reason; retry. |

The catalog arrives after the product starts, so a name is checked when a tenant starts, not at
startup. Nothing is published on a failure. Starting the same tenant again, also from another
instance, returns `TenantStart.AlreadyStarted` and publishes nothing; if the product stopped
between the two facts, starting again completes what is missing. A different default later does
not restart a tenant.

## Event store

Herald, Box Office and the offering record in the host application's own event store in a host set
up with `AddCratis` or `AddCratisChronicle`; nothing needs naming. Set `HeraldOptions.EventStore`,
`BoxOfficeOptions.EventStore` or `OfferingOptions.EventStore` only to use another store. A host that
registers only the Chronicle client uses the name in `ChronicleClientOptions.EventStore`.

## Verify

1. After the operator publishes the offer, `StartTenant` for a new tenant publishes
   `TenantStartedOnOffer`; a second call returns `TenantStart.AlreadyStarted`.
2. Before the offer is published, `StartTenant` throws `DefaultOfferingNotPublished` and publishes
   nothing.
