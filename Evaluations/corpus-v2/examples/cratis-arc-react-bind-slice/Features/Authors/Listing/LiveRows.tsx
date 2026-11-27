import { AllAuthors, AuthorsNamed } from '../../../generated/Features/Authors/Listing/Author';

export function LiveRows() {
    const [authors] = AllAuthors.use();
    if (!authors.isAuthorized) return <p>Not authorized.</p>;
    if (!authors.isValid) return <p>Invalid query.</p>;
    if (authors.hasExceptions) return <p>Could not load authors.</p>;
    if (authors.isPerforming || !authors.isReady) return <p>Loading authors…</p>;
    if (!authors.isSuccess) return <p>Could not load authors.</p>;
    if (!authors.data.length) return <p>No authors yet.</p>;
    return <ul>{authors.data.map(a => <li key={String(a.id)}>{a.name}</li>)}</ul>;
}

export function MatchRows({name}: {name: string}) {
    const [matches] = AuthorsNamed.when(name.trim().length > 0).use({ name: name.trim() });
    if (!name.trim()) return <p>Enter an author name.</p>;
    if (!matches.isAuthorized) return <p>Not authorized.</p>;
    if (!matches.isValid || matches.hasExceptions) return <p>Search failed.</p>;
    if (matches.isPerforming || !matches.isReady) return <p>Searching…</p>;
    if (!matches.isSuccess) return <p>Search failed.</p>;
    return <ul>{matches.data.map(a => <li key={String(a.id)}>{a.name}</li>)}</ul>;
}
