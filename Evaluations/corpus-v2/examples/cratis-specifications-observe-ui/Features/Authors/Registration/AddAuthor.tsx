import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { Guid } from '@cratis/fundamentals';
import { RegisterAuthor } from '../../../generated/Features/Authors/Registration/RegisterAuthor';

export const AddAuthor = () => (
    <CommandDialog<RegisterAuthor> command={RegisterAuthor} title="Add author"
        okLabel="Add" initialValues={{ id: Guid.create() }}>
        <InputTextField<RegisterAuthor> value={author => author.name} title="Name" />
    </CommandDialog>
);
