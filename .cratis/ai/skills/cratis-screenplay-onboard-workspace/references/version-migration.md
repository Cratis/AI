# Migrate retired Screenplay 5 forms

Use Screenplay 6 or later (`screenplay --version`) if the compiler names `screenplay migrate`, reports `PLAY0890`–`PLAY0896`, or the model is known to use Screenplay 5 forms. Use the actual whole model root (here `model`); don't hand-translate individual files of a split model because outlets and references can cross files.

1. Start from a clean model tree. Create the local report directory, then preview:

   ```sh
   screenplay migrate model --from 5 --to 6 --dry-run --report reports/migrate.json
   ```

2. Review the preview, then run the same command without `--dry-run` on the whole root. Exit 0 means migration completed, 2 means items need review, and 1 means it could not run. Read the report and resolve each review item with the owner; do not treat exit 2 as completion.
3. Review the diff for unrelated changes, run `screenplay model --warnaserror` and `screenplay test model`, and commit the verified migration separately before making the requested edit.
