import { TimeMachine } from '@cratis/components/TimeMachine';

type Snapshot = { id: string; timestamp: Date; title: string };
export function BookHistory({ snapshots, select }: { snapshots: Snapshot[]; select: (index: number) => void }) {
    if (!snapshots.length) return <p>No book history.</p>;
    const versions = snapshots.map(s => ({ id: s.id, timestamp: s.timestamp, label: s.title, content: <p>{s.title}</p> }));
    return <TimeMachine versions={versions} currentVersionIndex={versions.length - 1} onVersionChange={select} />;
}
