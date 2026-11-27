import { withViewModel } from '@cratis/arc.react.mvvm';
import { AllAuthors } from '../../../generated/Features/Authors/Listing/Author';
import { AuthorSearchViewModel } from './AuthorSearchViewModel';

export const AuthorSearch = withViewModel(AuthorSearchViewModel, ({ viewModel }) => {
    const [authors] = AllAuthors.use();
    if (!authors.isReady) return <p>Loading authors…</p>;
    if (!authors.isSuccess) return <p>Could not load authors.</p>;
    return <section>
        <label>Search authors<input value={viewModel.search}
            onChange={event => viewModel.setSearch(event.target.value)} /></label>
        <ul>{viewModel.filter(authors.data).map(a => <li key={String(a.id)}>{a.name}</li>)}</ul>
    </section>;
});
