# Keep the observer in a supported host

Python has no released application reactor. Have a supported service register the observer and call the Python worker with a stable, effect-specific delivery key. Let the worker store that key atomically with its effect and return its prior outcome on retry. Generated observer messages alone do not provide registration, checkpointing or redelivery.
