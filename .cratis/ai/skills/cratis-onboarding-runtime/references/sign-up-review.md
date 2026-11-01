# Sign-up review

Requires Ante 1.6.0 or later (`Ante:Registration:Review`, `RegistrationReview` in the onboarding
contract). Older releases complete every sign-up without a decision and publish neither event
below.

Review is off by default and changes nothing while off. Turn it on when a person must be approved
before an organization is created.

## Flow

1. A person finishes the sign-up. With review on, Ante accepts it but holds it: no
   `OrganizationRegistrationCompleted` is published and the registration is not complete.
2. Ante publishes `OrganizationRegistrationAwaitingReview` to its outbox, once per registration, on
   the registration id. It carries the same details `OrganizationRegistrationCompleted` would carry:
   the organization name asked for, the contact address (can be empty, never verified), the names,
   the sign-in subject and provider, and the untrusted sign-up context.
3. The host shows the sign-up to its reviewers. Ante has no administrator screen and takes no
   decision itself.
4. The host appends one of these to **its own store's outbox**, with the registration id as the
   event source id:
   - `OrganizationRegistrationApproved`: Ante completes the registration as it would have without
     review and publishes `OrganizationRegistrationCompleted`.
   - `OrganizationRegistrationDeclineRequested(Message)`: Ante publishes
     `OrganizationRegistrationDeclined` with the contact address, the name the person gave and the
     reviewer's message. `Message` is required; a blank one is refused and nothing is published.

## Rules

- A registration is decided once. A decision for a registration that was completed, was already
  declined or was never held is ignored, so redelivery is safe and a completed registration is
  never declined afterwards.
- Deduplicate `OrganizationRegistrationAwaitingReview` by registration id, like every Ante outcome:
  delivery is at least once.
- If an approved registration's organization name was claimed by someone else while it waited, it
  stays held and Ante logs a warning. Decline it with a message instead.
- While a sign-up is held the lobby tells the person it is waiting for review; after a decline it
  says the sign-up was not approved, stops polling and offers no second submission.
- Ante emails no one. The host sends the person the declined message from
  `OrganizationRegistrationDeclined` (Herald, `signupDeclined` template with `decline.message`).
- `OrganizationRegistrationDeclined` is the only outcome that says a person was turned down.
  `InvitationRejected` says an invitation did not match what the host allows; treat it as a
  configuration problem for whoever issued the invitation.

## Verify

1. With review on, a sign-up produces `OrganizationRegistrationAwaitingReview` and no
   `OrganizationRegistrationCompleted`.
2. Appending `OrganizationRegistrationApproved` on the registration id produces
   `OrganizationRegistrationCompleted`; appending it again produces nothing.
3. A decline request with a blank message publishes nothing; with a message it publishes
   `OrganizationRegistrationDeclined` once.
