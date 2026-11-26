import { useRef, useState } from 'react';
import { Graphics } from 'pixi.js';
import { Canvas, type CanvasHandle } from '@cratis/components/Canvas';
const marks = [{ id: 'Pin', x: 64, y: 48 }];
const renderMark = () => new Graphics().circle(0, 0, 12).fill(0x804080);
export function View() {
    const camera = useRef<CanvasHandle | null>(null);
    const [selected, select] = useState('');
    return <div style={{ position: 'relative', width: 480, height: 320 }}>
        <Canvas items={marks} renderItem={renderMark} showControls={false} showMinimap={false}
            style={{ width: '100%', height: '100%' }} onHandleReady={h => { camera.current = h; }}
            onItemPointerDown={item => select(previous => previous + item.id)} />
        <button style={{ position: 'absolute', top: 0, right: 0 }}
            onClick={() => camera.current?.smoothPanZoomToWorld(64, 48, 2, 80)}>Center pin</button>
        <output>{selected}</output></div>;
}
