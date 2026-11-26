import { Canvas, CanvasItem } from '@cratis/components/Canvas';

type BoardBook = { id: string; title: string; x: number; y: number };
export function BookBoard({ book, openBook }: { book: BoardBook; openBook: (id: string) => void }) {
    return <div style={{ width: '100%', height: 480 }}>
        <Canvas style={{ width: '100%', height: '100%' }} showControls>
            <CanvasItem id={book.id} x={book.x} y={book.y}>
                <button type="button" onClick={() => openBook(book.id)}>{book.title}</button>
            </CanvasItem>
        </Canvas>
    </div>;
}
export const View = () => <BookBoard book={{id:'reviews', title:'Book reviews', x:100, y:100}}
    openBook={id => { window.location.hash = id; }} />;
