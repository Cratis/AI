# Connect the writer and reader to the same store

Map a Spring Data MongoDB `@Document` record to the collection used by the writer, then inject the Java repository into a query method as a service. With JPA use the entity/table mapping instead. Check the actual database and collection for the selected tenant; an empty Java query may be reading the right schema under the wrong name.

Use the same ID with different values in two tenants to test both routing and isolation. For a projection rename, replay into the new collection before switching readers; changing the annotation does not move old data.
