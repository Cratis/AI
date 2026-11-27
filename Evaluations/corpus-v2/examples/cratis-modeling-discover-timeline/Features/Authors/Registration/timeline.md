# Register Aster

| Question | Concrete example |
|---|---|
| Who asks for what? | A librarian submits `RegisterAuthor` with ID `11111111-1111-4111-8111-111111111111` and name Aster. |
| Whose history changes? | `AuthorRegistered` records Aster on that author ID, not the librarian's history. |
| What is visible? | One row with the requested author ID and Aster. |
| Where does the name come from? | `AuthorRegistered.Name`. |
| What needs a decision? | Confirm the blank-name refusal and unchanged list with the domain owner. |
