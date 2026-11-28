# Map fields on the Node model

Decorate the model with `@fromEvent(BookAdded)` and its title field with `@setFrom(BookAdded, "title")`. Include the model in artifact discovery before opening the store. In a disposable namespace, query `await store.readModels.getInstances(Book)` and match the expected book ID. Check both a missing book and two distinct books after replay; an empty materialized collection is not proof that the producer rejected an append.
