# Decide what the caller supplies

For each field ask who owns it: did the user enter it, did the caller identify a target, did the server generate it, or did the command return it? Displaying a receipt number after success does not make it an editable input. Generating a number does not provide authorization, gapless allocation or duplicate-request protection. Declare the response the caller actually needs; do not return an entire private fact to expose one field.

| Comparison | Suitable input | Refuse rather than guess |
| --- | --- | --- |
| Calendar date | Compare `Date` to a compatible date. | Don't turn a calendar date into local midnight to compare it with an instant. |
| Instant | Compare `DateTime` with a timestamp carrying `Z` or an explicit offset. Different offsets may name the same instant. | Don't supply the machine's time zone for an offset-free input or silently round precision to fit a host. Comparing two inputs is not consulting the current clock. |
| UUID | Use equality or inequality between required compatible scalar values in `require` or a conditional production. | Don't order UUIDs or equate two different nominal concepts because both wrap UUIDs. |

For a required `Date` named `night`, use `night >= today` in `validate` if the business rule allows the current local date. Pin the clock and the business time zone in the example: the same instant can be two different booking dates. This validation does not schedule work when midnight passes.

Separate enforcement boundaries. Portable concept rules validate command inputs and query arguments, including concept values within collections or composite inputs. Do not infer validation on an unrelated host path. A policy admits a caller, not a persona label or seeded row. Command authorization runs before property checks; required reads follow property checks and precede the requirements using them. For a missing instance or unusable protected key the result is `<ReadModel> does not exist.` Do not add the key to that message. A preflight read cannot settle a race for a unique value: enforce the invariant at append and prove that the losing attempt appends no fact. Keep actor identity, the person the data is about, the tenant and the addressed stream separate.

A text `not empty` rule rejects Unicode whitespace-only input. If a pattern matters, check that the portable `match` expression accepts and rejects the owner's exact samples; don't import host regex behavior by assumption. Use only values available in the decision's typed context: event-production metadata is not client input, and a performer is not a command handler.

Prefer a declarative rule for an admitted decision. For fixed productions, a described handler computes payloads; this is not authority to reject the command or invent a different list of events. If the implementation decides which declared events to emit, express the possible events with `may produce`. Distinguish a description of missing behavior, a resolved implementation attachment and the provider that can execute that attachment. A source path for navigation supplies none of those guarantees.

A concept classifies the value; a processing purpose explains the use. Keep the subject of an event explicit when it is not the stream owner. For a persisted enum, pin every member number or none; explicit numbers must be distinct signed 32-bit integers, not aliases or flag combinations. Without pins, reordering members can change stored meaning.

`produces event` declares a local fact; referring to an existing event is not another definition. If extracting an inline event, preserve its production position, mappings, identity and destination. A `public event` is a contract to expose through the boundary, not a new permission on a command. Likewise `produces operation X` defines an operation; `produces X` refers to it.

Pre-commit work with an external system is an operation, not a reaction to an already accepted event. Model execution and compensation in their actual order. An accepted description is useful for discussion even when it cannot bind for execution: report the missing capability instead of moving the call after commit without the owner's agreement.
