# Node: register and list a task

Use Node 22.19 or later, Corepack and curl. The server package is `@cratis/arc.core@1.0.0`, not the browser packages `@cratis/arc` or `@cratis/arc.react`. Use an ESM server project with standard decorators (`ESNext.Decorators`), as in the sample. For a configured project with decorators, metadata and validation, run the Tasks sample from the Arc.TypeScript `v1.0.2` checkout:

```sh
git clone --branch v1.0.2 --depth 1 https://github.com/Cratis/Arc.TypeScript.git
cd Arc.TypeScript
corepack enable
yarn install
yarn build
yarn workspace @cratis/arc.core.sample.tasks start
```

The sample's `RegisterTask` class uses `@command()`, declares `title` with `@field(TaskTitle)` and implements `handle(tasks: Tasks)`. The handler registers the task and returns its ID. While the sample listens on loopback, run:

```sh
curl -sS http://127.0.0.1:3000/api/tasks/registration/register-task -H 'Content-Type: application/json' -d '{"id":"11111111-1111-4111-8111-111111111111","title":"Review"}'
curl -sS http://127.0.0.1:3000/api/tasks/listing/all-tasks
```

Expect `isSuccess: true`, the supplied ID as `response`, then the saved task in `data`. An empty title returns 400. The development host keeps tasks in memory; a restart clears them. Do not expose its development configuration publicly.
