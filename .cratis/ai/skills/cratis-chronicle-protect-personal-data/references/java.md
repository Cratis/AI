# Use the Java compliance bridges

Annotate the email value record with `@Pii(description = "Customer email address")`. Use an opaque customer ID and keep the email out of routing metadata. Given the subject-bearing model and service, call `ReadModelsJavaBridge.release(readModels, instance)`. In the disposable erasure case call `ComplianceServiceJavaBridge.deleteEncryptionKey(complianceService, opaqueId)`; then repeat retrieval with the intended subject. Do not generalize one key deletion to plaintext copied elsewhere.
