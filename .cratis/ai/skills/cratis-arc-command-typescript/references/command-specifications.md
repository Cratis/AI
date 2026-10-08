## Specify the command with CommandScenario

`@cratis/arc.testing` runs a command through the real pipeline in-process —
binding, authorization, validators, services, `provide()`, `handle()` — without
a listener. From `Samples/Tasks`:

```typescript
import { CommandScenario } from '@cratis/arc.testing';
import { Tasks } from '../../../Tasks.js';
import { RegisterTask, RegisterTaskValidator } from '../../Registration.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_task_registration {
    tasks = new Tasks();
    scenario = CommandScenario.for(RegisterTask, RegisterTaskValidator);

    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(Tasks, this.tasks);
    }
}
```

```typescript
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { TaskId } from '../../../TaskId.js';
import { TaskTitle } from '../../../TaskTitle.js';
import { a_task_registration } from '../given/a_task_registration.js';

describe('when registering a task with a valid title', given(a_task_registration, context => {
    const id = TaskId.create();
    let result: ScenarioCommandResult;

    beforeAll(async () => {
        result = await context.scenario.execute({ id, title: new TaskTitle('Plan release') });
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed through the command pipeline', () => { result.shouldBeSuccessful(); });
}));
```

- `CommandScenario.for(Command, ...artifacts)` — pass the validators and other
  artifacts the command needs; it cannot discover classes that were never
  imported.
- Register fakes on `scenario.services` **before** the first call.
  `extend(builder => ...)` installs builder setup such as generated metadata.
- `execute(values)` runs everything; `validate(values)` stops before
  `provide()`/`handle()`. `withContext({ principal, tenantId, correlationId })`
  sets a trusted caller.
- `given(Context, ...)` creates **one** context per `describe`: act in
  `beforeAll`, dispose in `afterAll`. A disposed scenario cannot run again.
- Assertions on the result: `shouldBeSuccessful()`, `shouldNotBeSuccessful()`,
  `shouldBeValid()`, `shouldHaveValidationErrors()`,
  `shouldHaveValidationErrorForMember(member)`, `shouldHaveValidationErrorFor(text)`,
  `shouldHaveValidationErrorBecauseOf(reason)`, `shouldBeAuthorized()`,
  `shouldNotBeAuthorized()`, `shouldHaveExceptions()`, `shouldNotHaveExceptions()`.
  Do not assert presentation text by default; assert exact wording only when it
  is the specified behavior, named in the fact. A text-matching helper alone
  does not prove exact equality; compare the actual message when equality is
  the requirement.
- Specify authorization for three callers — anonymous, without the role, with
  it — and on `validate()` too.
