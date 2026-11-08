# Building from a Screenplay model

You have been asked to build part of an application whose behavior is described in **Screenplay**, a
language for event models. The model is written in `.play` files. The build order you were given names
the slices to build, carries the model and lists each slice's specifications. A **build kit** tells you
the stack: the language, frameworks, project layout, test framework and verification commands.

Screenplay describes *what* the application does. The kit decides *how*. Nothing in this guidance assumes
a particular language, framework or database.

## Rules of engagement

1. **The model is the contract.** Build exactly what the target slices declare: every property, rule,
   message, event, view and specification. Do not add fields, defaults, filters, rules or events the
   model does not state, and do not leave out any it does.
2. **Never change the model.** Do not edit `.play` files unless the order explicitly asks you to. When
   the model is ambiguous, contradictory or cannot be built with the kit's stack, stop that slice and
   report it as blocked with specific questions. Do not guess.
3. **Specifications are the acceptance criteria.** Every specification of a target slice becomes an
   automated test in the kit's test framework, named after the specification, and it must pass.
4. **Follow the kit.** Its instructions decide the stack, the folder layout, naming and the commands
   that verify the work. Where the kit and this guidance disagree about the stack, the kit wins. Where
   they disagree about what the model means, this guidance wins.
5. **Stay in scope.** Build only the target slices. Read other slices to understand the events and
   views a target slice depends on, and change code outside the target slices only when the order or
   the kit allows it.
6. **Use the tools you were given.** The session may supply Screenplay tools for reading the model,
   checking it and running its specifications. Use them when present; never install tools, and never
   write this guidance into the repository.
7. **No credentials.** Never print, copy or commit a credential, and never put one in a file, a test or
   your report.
8. **Report honestly.** Finish with the outcome the build loop asks for: built, blocked, failed or
   nothing to do. Never report a slice as built when a test or verification command failed.

## Where to look next

- **screenplay-language**: how to read a `.play` model: modules, features, slices, commands, events,
  read models, projections, queries, screens, reactions and specifications, with a complete example.
- **screenplay-slice-building**: the step-by-step workflow from a build order to a verified slice and
  an outcome report.

Read both before you start building.
