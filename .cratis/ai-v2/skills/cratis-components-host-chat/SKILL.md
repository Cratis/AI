---
name: cratis-components-host-chat
description: Use when a host must supply conversations, messages and outcomes to a Chat view. Not for generic notifications (cratis-components-coordinate-feedback).
---

# Host a conversation without mixing topics

Use the public ChatConversation component for a single conversation. The host owns topic selection, ordered messages and command outcomes; a send callback is intent, not proof of delivery.

Use the component subpath imports below. If the installed declarations lack one of these props, inspect the package export and the host renderer before changing the interaction.

1. Keep one stable topic id per message and render only the selected topic. Done: switching to Notes replaces the Books transcript.
2. Capture the topic before awaiting the write. Append a confirmed response only to its original topic, or leave an observed query as the sole message source. Done: late responses cannot migrate to the currently open conversation.
3. Reject a send in the second conversation and return to the first. Done: Notes shows Message not sent; Books still shows the accepted message and no Notes error.

## Example

Mount this view inside the configured application host.

```tsx
import { useState } from 'react';
import { ChatConversation, type ChatMessage } from '@cratis/components/Chat';
const message = (topicId: string, body: string): ChatMessage => ({ id: crypto.randomUUID(), topicId,
    body, authorId: 'editor', timestamp: new Date() });
export function View() {
    const [topic, choose] = useState('Books');
    const [messages, replace] = useState(() => [message('Books', 'First proof'), message('Notes', 'Margin notes')]);
    const [errors, report] = useState<Record<string, string>>({});
    async function send(body: string) {
        const target = topic;
        try {
            const response = await fetch('/messages', { method: 'POST', body: JSON.stringify({ topicId: target, body }) });
            if (!response.ok) throw Error();
            const accepted = message(target, body);
            replace(previous => [...previous, accepted]); report(previous => ({ ...previous, [target]: '' }));
        } catch { report(previous => ({ ...previous, [target]: 'Message not sent' })); }
    }
    return <><label>Topic<select value={topic} onChange={e => choose(e.target.value)}>
        <option>Books</option><option>Notes</option></select></label>
        <ChatConversation key={topic} messages={messages.filter(m => m.topicId === topic)} onSendMessage={send}/>
        <output>{errors[topic]}</output></>;
}
```

If a rejected message looks delivered, check whether the composer updated host history before persistence completed. Keep transient errors indexed by topic, not in a shared last-error string.

Read references/observed-topics.md when the host already has observable topic and message queries.

## Verify

In the cratis-components-host-chat example fixture, run `npm run test:example`. Notes shows Message not sent; Books still shows the accepted message and no Notes error.
