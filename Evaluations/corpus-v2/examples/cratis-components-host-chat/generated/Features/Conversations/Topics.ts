import { ObservableQueryFor } from '@cratis/arc/queries';
import type { ChatTopic } from '@cratis/components/Chat';

export class Topics extends ObservableQueryFor<ChatTopic[]> {
    readonly route = '/topics';
    readonly defaultValue = [];
    readonly parameterDescriptors = [];
    get requiredRequestParameters(): string[] { return []; }
    constructor() { super(Object, true); }
}
