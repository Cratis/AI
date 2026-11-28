# Delegate the decision, not just the write

Python has no released application-client recipe for guarded decisions. Send the booking intent to the service owning the event history; let it read, decide and append with the guard. A Python precheck followed by an unconditional append in that service leaves a race. Surface a business refusal or conflict to the caller rather than treating either as successful acceptance.
