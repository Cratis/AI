# Exercise focus in a browser

Use an isolated loopback host, a fresh browser context and synthetic data. Start focus on the named trigger, open the form with the keyboard, submit and observe the new focus target. Assert which element actually has focus rather than spying on `.focus()`. For live data, let requests reach the disposable backend and assert the displayed value from the resulting read. Keep screenshots and traces off by default; if needed, capture only a permitted synthetic case. Close the context and host even on failure.
