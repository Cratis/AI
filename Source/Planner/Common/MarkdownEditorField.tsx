// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { useState } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { asCommandFormField, WrappedFieldProps } from '@cratis/arc.react/commands';

interface MarkdownEditorFieldComponentProps extends WrappedFieldProps<string> {
    placeholder?: string;
    rows?: number;
    className?: string;
}

const MarkdownEditorFieldComponent = (props: MarkdownEditorFieldComponentProps) => {
    const [preview, setPreview] = useState(false);

    return (
        <div className='flex w-full flex-col gap-2' data-color-mode='dark'>
            <div className='flex justify-end'>
                <Button
                    type='button'
                    label={preview ? 'Edit' : 'Preview'}
                    icon={preview ? 'pi pi-pencil' : 'pi pi-eye'}
                    text
                    size='small'
                    onClick={() => setPreview((current) => !current)} />
            </div>
            {preview
                ? (
                    <div className={`min-h-[8rem] w-full rounded border border-[var(--surface-border)] p-3 ${props.className ?? ''}`}>
                        <MarkdownPreview source={props.value || '_Nothing to preview_'} style={{ background: 'transparent' }} />
                    </div>
                )
                : (
                    <InputTextarea
                        value={props.value}
                        onChange={(event) => props.onChange(event.target.value)}
                        onBlur={props.onBlur}
                        invalid={props.invalid}
                        placeholder={props.placeholder}
                        rows={props.rows ?? 8}
                        className={`w-full font-mono ${props.className ?? ''}`} />
                )}
        </div>
    );
};

/**
 * A markdown editor with an edit/preview toggle, bound to a `string` property on a Cratis Arc
 * command - the one control every multi-line text in the Planner should use (work prompts, issue
 * and group instructions, alert notes) instead of a plain textarea.
 *
 * ```tsx
 * <MarkdownEditorField value={c => c.prompt} title='Prompt' rows={10} />
 * ```
 */
export const MarkdownEditorField = asCommandFormField(MarkdownEditorFieldComponent, {
    defaultValue: '',
    extractValue: (value: unknown) => value as string,
});
