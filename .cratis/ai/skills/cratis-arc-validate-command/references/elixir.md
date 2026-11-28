# Reject invalid input before the write

Put input constraints on the command schema, e.g. `field :name, :string, required: true, min_length: 2`. For cross-field rules return `{:error, Cratis.Arc.Validation.error(message, [:name])}` from `validate/2` on failure and `:ok` on success. Exercise the actual pipeline and inspect the member path before checking that nothing was appended.

A unique name is a store constraint, not a preflight lookup: declare a Chronicle uniqueness constraint and handle `constraintViolation` on conflict. `X-Allowed-Severity` is a command setting, not permission to bypass authorization or weaken query admission.
