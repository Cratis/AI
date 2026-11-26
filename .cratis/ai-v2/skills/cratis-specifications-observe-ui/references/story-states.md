# Isolate each story interaction

Construct a new recorder and initial list at story render, not module load. Scope accessible queries to the story canvas, or to the named dialog if it is portaled. Confirm blank input starts with Add disabled and no recorded calls. After entering a value and submitting, assert the exact argument and visible list content; if a second run starts populated, reset the fixture rather than compensating with a higher expected count.
