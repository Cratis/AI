# Diagram the reviewable path

```mermaid
flowchart LR
    screen[Add author] --> intent[RegisterAuthor]
    intent -->|accepted for AuthorId| fact[AuthorRegistered]
    fact -->|Name from payload, Id from source| view[Author]
    view --> list[Authors row]
    intent -->|blank name| error[Name error, no append]
```

Read the arrows forward with the actor, then cover the left side and ask where each displayed field originated. Repair missing origins before treating the diagram as implementation input.
