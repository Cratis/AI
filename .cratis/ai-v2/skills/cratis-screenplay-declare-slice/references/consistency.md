# Source and ownership

Identify the decision that needs serialized history. Name AuthorHistory and its AuthorId rather than using the editor, tenant or query row as the source. Keep the editor in caller context. Two editors registering different authors have two source IDs; a new editor operating on the same author does not change that author's ID. Resolve duplicate business names relative to this boundary before promising uniqueness across authors.
