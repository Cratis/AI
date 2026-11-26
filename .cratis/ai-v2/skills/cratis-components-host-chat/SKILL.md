---
name: cratis-components-host-chat
description: Adds a chat sidebar fed by an observable topics query and a per-topic messages query. Use when a screen needs topic-based chat. Not for confirmation or busy dialogs (use cratis-components-coordinate-feedback).
compatibility: Requires react, @cratis/components and @cratis/arc.react.
---

# Show messages for the selected topic

1. Place `TopicChat.tsx` in `Features/Conversations` inside the application's [Arc provider](../cratis-arc-react-bind-slice/SKILL.md). This slice has [generated proxies](../cratis-arc-generate-proxies/SKILL.md) `Topics` and `Messages` under `generated/Features/Conversations`. Don't copy them into the UI folder. `Messages` takes `{ topicId: string }`.
2. The `Topics` query returns rows with an `id` and optionally `name`. Each row returned by `Messages` must have `id`, `topicId`, `authorId`, `body: string` and `timestamp: Date`. Use string IDs or IDs that implement `toString()`. Here `authorId` identifies the message sender, not a catalog author.
3. Render the sidebar even when it is closed. Toggle `open` instead of mounting it conditionally, so the topic list continues to receive updates. Return `undefined` from `messagesArguments` until a topic is open.
4. Supply the application's send operation. The example passes through the message body and mentions with the topic ID received by `onSendMessage`. The caller must handle errors from sending against that topic.

```tsx
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
```

## Enable optional topic actions

Set `authorOf` to a function taking the author ID and returning a `ChatAuthor` with `{ name, kind }`. Use `ChatAuthorKind.User` for people or `ChatAuthorKind.Agent` for agents; import `type ChatAuthor` and `ChatAuthorKind` from `@cratis/components/Chat`. Set `onStartTopic` to the operation that creates a topic and returns its ID. Set `onRequestTopicName` to the operation that names an unnamed topic using its first message body.

## Avoid

- Don't return `{}` for missing message arguments; return `undefined` to skip the subscription.
- Don't send to whichever topic happens to be selected when a request completes. Carry the ID from `onSendMessage` through the operation and its error handling.

## Related skills

- [Bind generated live queries](../cratis-arc-react-bind-slice/SKILL.md)
