# Building a Cratis application

Start with the behavior the caller should observe. Follow the application's local conventions and installed package versions.
Arc exposes commands for intent and queries for reads. Chronicle stores facts and builds views from them. Components renders the UI; generated Arc proxies connect it to the backend.
For a whole behavior, load `cratis-platform-deliver-slice`. For a change to one artifact, match the request to the skill's positive trigger and check its nearest exclusion.
Load a linked skill only when the current task reaches its boundary. Read a reference when its stated condition applies.
If the team uses Screenplay, distinguish an approved model change from permission to render or change the running system. Do not introduce a model file just to implement a code-first slice.
Treat generated outputs as outputs. Change the owning contract and regenerate them.
Do not trust caller-supplied identity or tenant scope. Validate access on the server, including observable reads. Keep credentials and personal data out of examples and diagnostics.
Verify the changed behavior with the smallest check that crosses the affected boundary. Report the command and outcome; distinguish source inspection, compilation, model acceptance and execution. Name unrun checks.
