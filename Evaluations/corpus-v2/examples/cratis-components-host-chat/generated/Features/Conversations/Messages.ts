import { ObservableQueryFor } from '@cratis/arc/queries';
import { ParameterDescriptor } from '@cratis/arc/reflection';
import type { ChatMessage } from '@cratis/components/Chat';

export class Messages extends ObservableQueryFor<ChatMessage[], { topicId: string }> {
    readonly route = '/topic-messages';
    readonly defaultValue = [];
    readonly parameterDescriptors = [new ParameterDescriptor('topicId', String, false)];
    get requiredRequestParameters() { return ['topicId']; }
    constructor() { super(Object, true); }
}
