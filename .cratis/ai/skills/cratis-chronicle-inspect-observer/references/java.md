# Inspect a Java worker without changing delivery

The blocking event store does not wrap the suspending observer-inspection API. Do not construct a Kotlin continuation. Open the configured Chronicle Workbench, select the Java worker's store and namespace, and locate the observer ID under **Observers**. Compare positions only on its event sequence. In **Failed partitions**, find the relevant partition and last attempted position.

Return the IDs and positions without copying payloads. If the ID does not appear, ask the worker owner to check registration; a missing observer has no checkpoint to compare.
