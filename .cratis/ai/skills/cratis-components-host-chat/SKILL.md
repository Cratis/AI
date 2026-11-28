---
name: cratis-components-host-chat
description: Use when a developer connects a topic-based chat sidebar to generated live queries or to topics and messages already owned by the host. Not for confirmation or busy dialogs (use cratis-components-coordinate-feedback).
compatibility: Requires react, @cratis/components and @cratis/arc.react.
---

# Show messages for the selected topic

Default to `ChatSidebarForObservableQueries` when the screen has generated live queries and does not already own that state. For host-owned arrays and selection, import `{ ChatSidebar }` from `@cratis/components/Chat` and use `<ChatSidebar open={open} onClose={onClose} topics={topics} messages={messages} selectedTopicId={selectedTopicId} onTopicSelected={id => setSelectedTopicId(id ?? null)} onSendMessage={(id, body, mentions) => send(String(id), body, mentions)} />` instead of subscribing again. Both bindings send with the explicit topic ID.

1. Place `TopicChat.tsx` in `Features/Conversations` under the application's `<Arc>` provider from `@cratis/arc.react`. This slice has generated observable query proxies `Topics` and `Messages` under `generated/Features/Conversations`. Don't copy them into the UI folder. `Messages` takes `{ topicId: string }`.
2. The `Topics` query returns rows with an `id` and optionally `name`. Each row returned by `Messages` must have `id`, `topicId`, `authorId`, `body: string` and `timestamp: Date`. Use string IDs or IDs that implement `toString()`. Here `authorId` identifies the message sender, not a catalog author.
3. Pass the generated query classes themselves to `ChatSidebarForObservableQueries`, not their `.use()` results. The adapter subscribes to topics and changes the message subscription with the open topic. Render the sidebar even when it is closed. Toggle `open` instead of mounting it conditionally, so the topic list continues to receive updates. Return `undefined` from `messagesArguments` until a topic is open.
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

Switch from one topic to another before the first topic's messages arrive. Only the selected topic's messages should appear. If messages are missing, check the argument name and the selected ID before changing the query.

## Enable optional topic actions

Add these props only if the host supplies the corresponding operations:

- `authorOf={id => ({ name: displayName(id), kind: ChatAuthorKind.User })}` resolves a sender. Import `{ ChatAuthorKind }` from `@cratis/components/Chat`; use `ChatAuthorKind.Agent` for an agent.
- `onStartTopic={() => startTopic()}` opens the topic whose ID the host returns. `onRequestTopicName={(topic, body) => nameTopic(topic.id, body)}` names a new topic from its first message.
- `topicActions={[{ id: 'rename', label: 'Rename', onInvoke: topic => renameTopic(topic.id) }]}` acts on the topic. `actions={[{ id: 'copy', label: 'Copy', icon: <span aria-hidden="true">⧉</span>, onInvoke: message => copyMessage(message.body) }]}` acts on one message.

## When it goes off the usual path

- **Send fails after the user switches topics:** keep the submitted draft and failure in the host under the ID received by `onSendMessage`. Offer recovery for that topic; don't show the failed send as a stored message or retry it against the newly selected topic.

## Related skills

- If the host owns the subscriptions, use `cratis-arc-react-bind-slice` from the Arc React profile. Pass `topicsStatus` and `messagesStatus` to `ChatSidebar`; an access denial or failed query is not an empty conversation.

Attach message actions with `actions` and host content with `renderMessageExtra`. Retain existing history through loading or failure; do not keep showing it when access is denied.
