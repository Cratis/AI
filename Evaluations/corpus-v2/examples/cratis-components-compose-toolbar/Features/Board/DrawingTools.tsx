import { useState } from 'react';
import { Toolbar, ToolbarButton, ToolbarContext, ToolbarFocusMode, ToolbarSection } from '@cratis/components/Toolbar';

export function DrawingTools({ mode, draw, annotate }: {
    mode: 'draw' | 'review'; draw: () => void; annotate: () => void;
}) {
    return <Toolbar aria-label="Shelf tools" focusMode={ToolbarFocusMode.SingleTabStop}>
        <ToolbarSection activeContext={mode}>
            <ToolbarContext name="draw"><ToolbarButton text="Shelf" title="Draw shelf" onClick={draw} /></ToolbarContext>
            <ToolbarContext name="review"><ToolbarButton text="Note" title="Add note" onClick={annotate} /></ToolbarContext>
        </ToolbarSection>
    </Toolbar>;
}
export const View = () => {
    const [mode, change] = useState<'draw' | 'review'>('draw');
    const [last, record] = useState('');
    return <><button onClick={() => change('review')}>Review mode</button>
        <DrawingTools mode={mode} draw={() => record('Shelf')} annotate={() => record('Note')} />
        <output>{last}</output></>;
};
