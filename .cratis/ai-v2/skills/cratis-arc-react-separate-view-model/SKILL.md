---
name: cratis-arc-react-separate-view-model
description: Use when introducing Arc MVVM or withViewModel to move complex React interactions into a testable view model. Not for a simple proxy binding (cratis-arc-react-bind-slice).
---

# Separate view behavior from rendering

Use withViewModel when interaction state has dependencies or lifecycle of its own. For one command input and query tuple keep the binding in the component.

Use the component subpath imports below. If the installed declarations lack one of these props, inspect the package export and the host renderer before changing the interaction.

1. Extract the decision and its dependency, not the query result array. Done: replacing the dependency changes what the same intent returns.
2. Bind the model class and read its observable inside the wrapped render. Done: the view sends intent without instantiating a model or copying its fields into useState.
3. Register the fixture dependency in the resolver before mount. Done: Preview changes No preview to Proof copy using the substitute, without a refresh button or copied query rows.

## Example

Mount this view inside the configured application host.

```tsx
import { withViewModel } from '@cratis/arc.react.mvvm';
import { inject, injectable } from 'tsyringe';

export class CaptionSource { next() { return 'Draft'; } }
@injectable()
class Preview {
    caption = 'No preview';
    constructor(@inject(CaptionSource) private source: CaptionSource) {}
    preview() { this.caption = this.source.next(); }
}
export const View = withViewModel(Preview, ({ viewModel }) => <>
    <button onClick={() => viewModel.preview()}>Preview</button><output>{viewModel.caption}</output>
</>);
```

If an interaction changes the model but not the view, move the observable read back inside the tracked render. If values leak across views, check whether the model was registered as a singleton. Let the wrapper own model lifetime; release model-owned listeners in detached().

Read references/browser-dependencies.md when the dependency is browser-specific.

## Verify

In the cratis-arc-react-separate-view-model example fixture, run `npm run test:example`. Preview changes No preview to Proof copy using the substitute, without a refresh button or copied query rows.
