export function renderAuthors(root: HTMLElement, record: (name: string) => void) {
    root.innerHTML = '<button>Add author</button><form hidden><label>Name <input></label><button disabled>Add</button></form><ul aria-label="Authors"></ul>';
    const open = root.querySelector('button')!;
    const form = root.querySelector('form')!;
    const input = form.querySelector('input')!;
    const submit = form.querySelector('button')!;
    const list = root.querySelector('ul')!;
    open.onclick = () => { form.hidden = false; input.focus(); };
    input.oninput = () => { submit.disabled = !input.value.trim(); };
    form.onsubmit = event => {
        event.preventDefault();
        if (!input.value.trim()) return;
        record(input.value);
        const row = root.ownerDocument.createElement('li');
        row.textContent = input.value;
        list.append(row);
        form.reset();
        submit.disabled = true;
        form.hidden = true;
        open.focus();
    };
}
