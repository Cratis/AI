import { useState } from 'react';
import { ToggleGroup } from '@cratis/components/Common';

export function View() {
    const [draft, edit] = useState('all');
    const [active, apply] = useState('all');
    return <><ToggleGroup aria-label="Scope" options={[{ value: 'all', label: 'Everyone' },
        { value: 'mine', label: 'Mine' }]} value={draft} onChange={edit}/>
        <button onClick={() => apply(draft)}>Apply</button><output>{active}</output></>;
}
