# Supervise an Elixir Arc application

Define the application boundary in the service namespace:

```elixir
defmodule Counters.Arc do
  use Cratis.Arc.Application, otp_app: :counters
end
```

Add `Counters.Arc` to the OTP supervisor's children after its dependencies and before the HTTP listener. Put commands and read models under the namespace the application discovers. Exercise a registered endpoint after startup: if the listener responds but the command is missing, check supervision and discovery before adding a Plug route for the command.
