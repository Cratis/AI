# Collect only the evidence the comparison needs

The application host and Chronicle kernel export independently. A command trace with no kernel spans may indicate a missing subscription, sampling or an unavailable receiver. Inspect the capture's producer and collection window before declaring that processing stopped. Use a fixture-local sink; unsetting the Chronicle OTLP endpoint alone does not disable export.

Record opaque fixture correlation IDs, operation names, outcomes, positions and durations. Do not include connection strings, authorization headers, command bodies or personal names from real data. Event source IDs can themselves identify people. Chronicle can hash or omit source identifiers in exported traces; apply the chosen policy separately in kernel and client. Logs are a separate exposure surface. If scope cannot be matched safely, label the comparison inconclusive; do not enable raw identifiers on a live target to fill the gap.
