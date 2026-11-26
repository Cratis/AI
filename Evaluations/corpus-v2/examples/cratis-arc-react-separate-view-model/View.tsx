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
