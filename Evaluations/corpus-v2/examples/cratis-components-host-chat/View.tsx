import { useState } from 'react';
import type { ChatMention } from '@cratis/components/Chat';
import { TopicChat } from './Features/Conversations/TopicChat';

export const View = () => {
    const [open, setOpen] = useState(true);
    const [error, report] = useState('');
    async function send(topicId: string, body: string, mentions: ChatMention[]) {
        try {
            const result = await fetch('/messages', { method: 'POST', body: JSON.stringify({ topicId, body, mentions }) });
            if (!result.ok) throw new Error('Message not sent');
        } catch { report(`Message not sent to ${topicId}.`); }
    }
    return <><button onClick={() => setOpen(true)}>Open topics</button>
        <TopicChat open={open} onClose={() => setOpen(false)} send={send} />
        {error && <p role="alert">{error}</p>}</>;
};
