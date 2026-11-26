import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

function checked(text) {
    const model = JSON.parse(text);
    if (!model.revision) throw new Error('Export lacks the model revision needed for approval comparison.');
    const pending = [...(model.application?.modules ?? [])];
    while (pending.length) {
        const node = pending.pop();
        if (node.specifications?.length) return model;
        pending.push(...(node.features ?? []), ...(node.slices ?? []));
    }
    throw new Error('Scoped export has no slice specifications; check the scope and accepted examples.');
}

try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--self-test') {
        const model = { revision: 'sample', application: { modules: [{ features: [{ slices: [{ specifications: [{}] }] }] }] } };
        assert.deepEqual(checked(JSON.stringify(model)), model);
        assert.throws(() => checked('{"revision":"sample"}'), /no slice specifications/);
    } else {
        if (args.length !== 2) throw new Error('Usage: export-scope.mjs <model-directory> <dotted-scope>');
        const [directory, scope] = args;
        console.log(JSON.stringify(checked(execFileSync('screenplay', ['export', directory, '--scope', scope], { encoding: 'utf8' }))));
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = error.status || 1;
}
