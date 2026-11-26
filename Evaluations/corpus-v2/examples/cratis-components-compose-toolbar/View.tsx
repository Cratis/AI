import { useState } from 'react';
import { Toolbar, ToolbarButton, ToolbarContext, ToolbarSection } from '@cratis/components/Toolbar';

export function View() {
    const [mode, change] = useState('draw');
    const [last, record] = useState('');
    return <><button onClick={() => change('review')}>Review mode</button><Toolbar>
        <ToolbarSection activeContext={mode}>
            <ToolbarContext name="draw"><ToolbarButton text="Line" title="Draw line" onClick={() => record('Line')}/></ToolbarContext>
            <ToolbarContext name="review"><ToolbarButton text="Note" title="Add note" onClick={() => record('Note')}/></ToolbarContext>
        </ToolbarSection></Toolbar><output>{last}</output></>;
}
