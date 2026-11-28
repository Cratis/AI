# Verify delivery after registering a webhook

Registration is not a test of the receiver. Set destination validation explicitly for the deployment. The Development **build** defaults to `Warn`; other builds default to `BlockLocalAddresses`. Do not infer the effective policy from the host environment name. Validate the receiver URL and any OAuth authority before authorizing outbound traffic. Investigate a blocked target rather than disabling validation to make it reachable.

Test with one disposable event and a receiver that records the event identity atomically with its effect. Check the receiver's receipt as well as observer progress. A quarantine probe is a real delivery of a pending event, not an empty health request; its schedule is independent of the ordinary delivery retry budget. If registration succeeded but no receipt exists, inspect the failed partition, receiver response and quarantine state before prescribing another send.
