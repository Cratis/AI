# Python contracts consumer

Use Node 22+, Python 3.10+ and an isolated virtual environment. From this directory install `python3 -m pip install -r requirements.txt` into the active environment. Then run `node --test acceptance.test.mjs`. It starts the Python interpreter from PATH, loads the generated message and service modules, and verifies protobuf round-trip behavior. No kernel or credentials are used. An unavailable package or missing interpreter is a setup failure, not a passing test.
