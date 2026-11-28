# Request a read-only observer diagnostic

Python has no released Chronicle application client for observer inspection. Ask the service owning the observer, or an operator with Workbench access, for its state in the specific store and namespace. Supply the observer ID, event sequence and accepted position. Ask for the checkpoint and matching failed partition, not payloads. A generated message round trip cannot establish that a live observer handled the event.
