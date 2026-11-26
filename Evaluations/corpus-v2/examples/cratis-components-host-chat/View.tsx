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
