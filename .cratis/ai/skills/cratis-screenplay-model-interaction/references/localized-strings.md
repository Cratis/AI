# Write companion strings

For `invoicing.play`, add `invoicing.en.strings` alongside it:

```text
// Invoice labels and notifications
invoices.fields.number = "Invoice number"
notifications.invoiceRegistered = "Invoice {number} from Acme"
```

Use the same dotted keys and preserve `{number}` and any other placeholders in each locale's file, such as `invoicing.nb.strings`. At a screen label or title, use the unquoted reference; for example, a form field can use:

```play
field invoiceNumber label $strings.invoices.fields.number
```

Use the same reference format for validation or requirement messages. Assert the symbolic key with `then error "$strings.<dotted.key>"` in the model spec, not the translation. Verify the host's selected locale and fallback separately; Stage-rendered validation looks up UI culture then its parents, then the default locale. Supply every modeled key in that default locale.
