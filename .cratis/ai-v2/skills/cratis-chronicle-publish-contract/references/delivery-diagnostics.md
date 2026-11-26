# Find the first missing copy

Read the producer outbox position first. If present, compare the consumer's subscription source and type filter and inspect the per-source inbox. An ordinary log append won't reach it. If the matching inbox copy exists, forwarding succeeded: examine the consumer observer, its partition and its downstream receipt instead. Changing a filter is not evidence that earlier unmatched events were delivered.
