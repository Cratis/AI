# @cratis/pi-direct

A [Pi](https://github.com/earendil-works/pi) package for Cratis Direct local sessions. When a Direct runner launches Pi for a work item, this package claims the work, keeps the claim alive with heartbeats and releases it with an outcome. In any other Pi session it does nothing.

```bash
pi install npm:@cratis/pi-direct
```

Setup, the personal access token and the harness contract are documented in the [Pi harness guide](https://www.cratis.io/direct/runner/harnesses#pi). If a session refuses to start, see [A harness session refuses to start](https://www.cratis.io/direct/runner/troubleshooting#a-harness-session-refuses-to-start).
