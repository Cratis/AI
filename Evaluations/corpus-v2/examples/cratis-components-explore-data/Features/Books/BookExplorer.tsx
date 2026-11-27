import { PivotViewer } from '@cratis/components/PivotViewer';

type Book = { id: string; title: string; genre: string };
export function BookExplorer({ books }: { books: Book[] }) {
    return <div style={{ height: 520 }}>
        <PivotViewer data={books} getItemId={book => book.id}
            dimensions={[{ key: 'byGenre', label: 'Genre', getValue: book => book.genre }]}
            cardRenderer={book => ({ title: book.title })} />
    </div>;
}
export const View = () => <BookExplorer books={[
    { id: 'a', title: 'Atlas', genre: 'Reference' }, { id: 'b', title: 'Almanac', genre: 'Reference' },
    { id: 'c', title: 'River', genre: 'Fiction' },
]} />;
