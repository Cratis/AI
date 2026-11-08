---
name: screenplay-slice-building
description: Use when a build order asks you to build, change or remove slices of a Screenplay model in a repository, and you must verify the work and report its outcome. Not for designing or editing the model.
---

# Building a slice from a build order

Work through these steps for each target slice in the order. Read the **screenplay-language** skill first
if you have not.

## 1. Read the order

The build order gives you:

- **Scope**: the application, the feature and the target slices, each with an address and a stable id.
  The id survives renames; match on it, not on the name.
- **The model**: the `.play` source, and where available its compiled form, with a revision.
- **Changes per slice** since the last build: added, changed, renamed or removed.
- **Specifications**: the acceptance criteria for each target slice.
- **Context**: conventions, comments and feedback on the slice, the attempt number and why the previous
  attempt failed.
- **A deadline.**

When this is a retry, start from the previous failure reason and fix that first.

## 2. Understand the slice

Find the slice by its address and read everything it uses: the events it records or reacts to, the
concepts and types of every property, the policies it authorizes with, and read models and events
declared in other slices. With Screenplay tools in the session, use them:

| Need | Tool |
| --- | --- |
| Overview of modules, features and slices | `describe-application` |
| A declaration's properties, productions and specifications | `declaration-details` |
| Who uses an event, read model or command | `find-references`, `dependencies` |
| What each declaration must be specified by | `find-specification-obligations` |

Without tools, read the `.play` files directly; the language is meant to be read.

## 3. Check the model

Check the scope before building on it: the `diagnostics` tool with `scope` set to the slice address, or
`screenplay <model-root> --scope <slice-address> --warnaserror` when the command is available. An error
in the slice's scope means the model cannot be built as written: report the slice as blocked, quote the
diagnostic and do not work around it.

## 4. List the obligations

Before writing code, list everything the slice declares, and keep the list until the end:

- every command property with its type, optionality and role (`identifier`, `generated`);
- every validation rule and its exact message, every constraint and its exact message;
- every authorization requirement;
- every event, each property and where each value comes from;
- every read-model property and the projection mapping that fills it;
- every query: its parameters, filters, caller scoping and whether it is observable;
- every screen's data and actions, when the kit includes a user interface;
- every reaction: what sets it off, what it reads, records and invokes;
- every specification.

Each item maps to something in the kit's stack. An item you cannot map is a question, not a guess.

## 5. Apply the change

| Change | Do |
| --- | --- |
| Added | Build the slice from the obligations |
| Changed | Update the existing code to the new declaration; keep everything that did not change |
| Renamed | Rename the code and keep data that is already stored readable, for example a renamed event keeps its stored identity |
| Removed | Remove the code that belongs to the slice and nothing that other slices still use |

Find the existing code through the stable id, the kit's layout and any `file` lines in the model.

## 6. Build it

- Follow the kit's instructions for structure, naming, language and frameworks.
- Keep the model's names. A command, event, read model or query keeps its declared name and property
  names; adapt only casing to the stack's conventions.
- Give concepts their own types where the stack allows it.
- Validation and constraint failures are rejections with the declared message, never crashes. An
  authorization failure is a separate denial.
- Record events exactly as the `produces` blocks say, in that order, on the declared event source.
- A constraint must hold under concurrent requests, not only in a check before recording.
- Reactions must be safe to run more than once for the same occurrence.

## 7. Turn every specification into a test

Write one test per specification, named after it, using the kit's test framework.
[The specification reference](../screenplay-language/references/specifications.md) maps every `given`,
`when` and `then` clause to an arrangement, action and assertion. Do not weaken an assertion to make a
test pass. When a specification cannot be expressed in the stack, report it as blocked.

## 8. Verify

1. Run the tests you wrote; all must pass.
2. Run every verification command the kit lists, unchanged. The build loop runs them again and trusts
   their result over your report.
3. With Screenplay tools available, run the slice's specifications in the model (`run-specifications`
   with `scope` set to the slice, or `screenplay test <model-root> --filter <specification-address>`). A
   model failure there means the model and the order disagree: report it.

## 9. Report the outcome

Report in the form the build loop asks for:

| Outcome | When | Include |
| --- | --- | --- |
| Built | Every obligation is built and every test and verification command passed | Changed files, a result per specification, every assumption you made |
| Blocked | The model is ambiguous, contradictory, has errors in scope or needs something the kit cannot do | The reason and the specific questions that would unblock it |
| Failed | Something went wrong that is not a question about the model | The error, and whether trying again could succeed |
| Nothing to do | The code already matches the model | Why nothing changed |

Never report Built with a failing or skipped test or verification command. Never put a credential in the
report.

## Do not

- Edit `.play` files, unless the order asks you to.
- Add behavior, fields or rules the model does not declare, or drop any it does.
- Write this guidance, tool configuration or session files into the repository, unless the kit asks for it.
- Install Screenplay tools or other software the kit does not list.
- Disable tests, permission checks or verification to finish faster.
