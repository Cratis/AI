import { RegisterAuthor } from './generated/Features/Authors/Registration/RegisterAuthor';
import { Author, AllAuthors } from './generated/Features/Authors/Listing/Author';

export const contracts = [RegisterAuthor, AllAuthors];
export const row = (author: Author): string => author.name;
export function populate(command: RegisterAuthor, author: Author) {
    command.id = author.id;
    command.name = 'Aster';
    // @ts-expect-error The command has no displayName wire member.
    command.displayName = 'Aster';
}
