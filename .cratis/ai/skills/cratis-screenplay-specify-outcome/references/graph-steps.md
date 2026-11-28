# Check graph state by identity

Use `given graph` for state already present before the action. Assert only the affected nodes and edges under `then graph`, including unaffected neighbors when isolation is the promise. For example, if `PersonRemoved` removes one node from `Organization`, seed two distinct `Person` nodes:

```screenplay
specification RemovingOnePerson
  given graph Organization
    has node Person "6fa459ea-ee8a-4ca4-894e-db77e160355e"
    has node Person "0f8fad5b-d9cb-469f-a165-70867728950e"
      name = "Grace"
  when append PersonRemoved
    for "6fa459ea-ee8a-4ca4-894e-db77e160355e"
  then graph Organization
    no node Person "6fa459ea-ee8a-4ca4-894e-db77e160355e"
    has node Person "0f8fad5b-d9cb-469f-a165-70867728950e"
      name = "Grace"
```

When `TAGGED` edges use `identified by role` and `Untagged` removes the role-specific edge, seed alternatives via the real projection so removal can't pass by deleting every edge between those endpoints:

```screenplay
specification RemovingOnlyOneRole
  given Joined
    for "6fa459ea-ee8a-4ca4-894e-db77e160355e"
    groupId = "0f8fad5b-d9cb-469f-a165-70867728950e"
    role = "reader"
  given Joined
    for "6fa459ea-ee8a-4ca4-894e-db77e160355e"
    groupId = "0f8fad5b-d9cb-469f-a165-70867728950e"
    role = "editor"
  when append Untagged
    for "6fa459ea-ee8a-4ca4-894e-db77e160355e"
    groupId = "0f8fad5b-d9cb-469f-a165-70867728950e"
    role = "reader"
  then graph Organization
    no edge TAGGED from "6fa459ea-ee8a-4ca4-894e-db77e160355e" to "0f8fad5b-d9cb-469f-a165-70867728950e" identified by "reader"
    has edge TAGGED from "6fa459ea-ee8a-4ca4-894e-db77e160355e" to "0f8fad5b-d9cb-469f-a165-70867728950e" identified by "editor"
```

Use the graph's declared labels and identity types. Put properties only beneath `has node` or `has edge`; a negative assertion names the identity, not properties.
