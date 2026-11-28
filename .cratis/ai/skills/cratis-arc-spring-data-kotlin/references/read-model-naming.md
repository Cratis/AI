# Switch collections without stranding existing projections

Check the writer's naming policy and the collection selected by the Spring Data `@Document` mapping. After a rename, replay into the new collection and compare a known tenant's reads before switching the repository and retiring the old collection. Do not test only a fresh empty database: a mapping change does not rename persisted collections.
