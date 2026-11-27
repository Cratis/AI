import { useState } from 'react';
import { ComboBox, DatePickerInput, NumberInput } from '@cratis/components/Common';

type AuthorOption = { key: string; label: string };
export function BookFields({ authors, loading, failure }: { authors: AuthorOption[]; loading: boolean; failure?: string }) {
    const [price, setPrice] = useState<number | null>(null);
    const [published, setPublished] = useState<Date | null>(null);
    const [authorId, setAuthorId] = useState<string | null>(null);
    return <>
        <NumberInput value={price} onChange={setPrice} aria-label="Price" />
        <DatePickerInput value={published} onChange={setPublished} aria-label="Published" />
        <ComboBox options={authors} value={authorId} onChange={setAuthorId} aria-label="Author"
            loading={loading} failure={failure} />
    </>;
}
export const View = () => <BookFields authors={[{ key: 'a', label: 'Aster' }]} loading={false} />;
