import { injectable } from 'tsyringe';
import type { Author } from '../../../generated/Features/Authors/Listing/Author';

@injectable()
export class AuthorSearchViewModel {
    search = '';
    setSearch(value: string) { this.search = value; }
    filter(authors: Author[]) {
        return authors.filter(author => author.name.toLowerCase().includes(this.search.toLowerCase()));
    }
}
