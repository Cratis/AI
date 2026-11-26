import { useState } from 'react';
import { Guid } from '@cratis/fundamentals';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { RegisterAuthor } from './generated/Authors/RegisterAuthor';

export function View() {
    const [id] = useState(() => Guid.create());
    const [open, show] = useState(true);
    const [message, report] = useState('');
    return <><CommandDialog<RegisterAuthor> visible={open} title="New author" okLabel="Register"
        command={RegisterAuthor} initialValues={{ id }} onCancel={() => show(false)}
        onValidationFailure={errors => report(errors.map(error => error.message).join('; '))}
        onSuccess={() => { report('Registered'); show(false); }}>
        <InputTextField<RegisterAuthor> value={c => c.name} title="Name" />
    </CommandDialog><output>{message}</output></>;
}
