import { ChatSidebarForObservableQueries, type ChatMention } from '@cratis/components/Chat';
import { Topics } from '../../generated/Features/Conversations/Topics';
import { Messages } from '../../generated/Features/Conversations/Messages';

type ChatProps = {
    open: boolean; onClose: () => void;
    send: (topicId: string, body: string, mentions: ChatMention[]) => void;
};
export function TopicChat({ open, onClose, send }: ChatProps) {
    return <ChatSidebarForObservableQueries open={open} onClose={onClose}
        topicsQuery={Topics} messagesQuery={Messages}
        messagesArguments={id => id === undefined ? undefined : { topicId: String(id) }}
        onSendMessage={(id, body, mentions) => send(String(id), body, mentions)} />;
}
