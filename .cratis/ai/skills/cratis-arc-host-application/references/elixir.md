# Supervise an Elixir Arc application

Define the application boundary in the service namespace:

```elixir
defmodule Counters.Arc do
  use Cratis.Arc.Application, otp_app: :counters
end
```

Add `Counters.Arc` to the OTP supervisor's children after its dependencies and before the HTTP listener. Put commands and read models under the namespace the application discovers. Exercise a registered endpoint after startup: if the listener responds but the command is missing, check supervision and discovery before adding a Plug route for the command.

Configure discovery under the application namespace, not as a global default for every supervised Arc application. Declare `available` at the part and configure the audience and suspension sources for that application. Availability runs before binding, filters and authorization. Unknown or unavailable is closed (403); suspension is also a denial. An undecidable evaluation yields retryable 503 rather than pretending the caller lacks entitlement.
