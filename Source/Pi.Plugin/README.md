# Cratis skills for Pi

This is the **standalone plugin path** for Pi. Install it with:

```bash
pi install -l npm:@cratis/pi
```

Pi discovers the packaged Cratis skills. It does not install persistent Cratis
rules, compose profiles or languages for a repository, configure other harnesses,
or protect a managed local corpus. Use `cratis ai install` for the managed path:
it places the selected corpus in `.cratis/ai`, configures Pi directly, and keeps
managed-file hashes for safe update and uninstall.
