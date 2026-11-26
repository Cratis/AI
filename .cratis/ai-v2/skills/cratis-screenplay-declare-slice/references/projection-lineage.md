# Trace a row backward

Write one line per visible field: query field → model property → projection expression → fact field or source metadata. For Aster the Name survives unchanged; Id is `$eventSourceId`. Check the projection with two different IDs before treating a single matching row as evidence that records cannot overwrite each other. Never add a display-only field to the command unless the actor actually supplies it.
