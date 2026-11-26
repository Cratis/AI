# Multiple routes open the same confirmation UI

Register ConfirmationDialog with DialogComponents above all callers. Give each useConfirmationDialog request its own title, message and buttons. Register a busy indicator only when pending work must block the surrounding application; close it in finally even on transport failure.
