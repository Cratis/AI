# Declare the Java model mapping

Place `@FromEvent(eventType = EmployeeHired.class)` on the read model and map the employee fields. Use a Java class literal, not a Kotlin property reference. Keep the ID derived from the selected employee key. Register it and inspect two stored employees after replay; finding the annotated class is not evidence they were written under separate keys.
