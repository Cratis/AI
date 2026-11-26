import { useState } from 'react';
import { Guid } from '@cratis/fundamentals';
import { AllAuthors } from './generated/Authors/Author';
import { RegisterAuthor } from './generated/Authors/RegisterAuthor';

export function View() {
    const [authors] = AllAuthors.use();
    const [id] = useState(() => Guid.create());
    const [command, setValues] = RegisterAuthor.use({ id, name: '' });
    const [status, report] = useState('');
    const [busy, setBusy] = useState(false);
    async function register() {
        setBusy(true);
        try {
            const result = await command.execute();
            report(result.isSuccess ? 'Registered' : !result.isAuthorized ? 'Not authorized' :
                result.validationResults.map(error => error.message).join('; ') || 'Registration failed');
        } catch { report('Registration unavailable'); }
        finally { setBusy(false); }
    }
    return <><label>Name<input value={command.name} onChange={e => setValues({ name: e.target.value })}/></label>
        <button disabled={busy} onClick={register}>Register</button><p role="status">{status}</p>
        <ul>{authors.data.map(author => <li key={String(author.id)}>{author.name}</li>)}</ul></>;
}
