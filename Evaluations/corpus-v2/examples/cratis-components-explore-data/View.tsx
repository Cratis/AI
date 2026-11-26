import { PivotViewer } from '@cratis/components/PivotViewer';
const editions = [{ id: 'a', region: 'East', copies: 12 }, { id: 'b', region: 'West', copies: 5 },
    { id: 'c', region: 'East', copies: 8 }];
export function View() {
    return <div style={{ height: 520 }}><PivotViewer data={editions} getItemId={item => item.id}
        dimensions={[{ key: 'region', label: 'Region', getValue: item => item.region }]}
        filters={[{ key: 'region', label: 'Region', getValue: item => item.region }]}
        cardRenderer={item => ({ title: item.id, labels: ['Copies'], values: [String(item.copies)] })}
        labels={{ itemCount: count => count + ' editions' }}/></div>;
}
