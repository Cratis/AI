/**
 * Creates Pi's package filter from paths already resolved by `cratis ai`.
 * Profile and language resolution deliberately stays in the CLI.
 * @param {string[]} skillPaths paths relative to the installed corpus
 * @returns {{ skills: string[], extensions: never[] }} Pi package filter
 */
export function createSkillFilter(skillPaths) {
    return { skills: [...new Set(skillPaths)].sort(), extensions: [] };
}
