import React from 'react';
import { FileText, Lock } from 'lucide-react';
import { useGameState } from '../context/GameStateContext';
import { storyData } from '../data/story';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';

const PinnedArchive: React.FC = () => {
    const { unlockedFiles, isArchivePinned, pinnedPositions, pinnedSizes, updatePinnedPosition, updatePinnedSize } = useGameState();

    const initialPos = pinnedPositions?.archive || { x: 460, y: 160 };
    const initialSize = pinnedSizes?.archive || { width: 320, height: 320 };
    const { pos, onMouseDown, isDragging } = useDraggable('archive', initialPos, updatePinnedPosition);
    const { size, isResizing, onResizeMouseDown } = useResizable('archive', initialSize, updatePinnedSize, { width: 260, height: 220 });

    if (!isArchivePinned) return null;

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                backgroundColor: 'rgba(0, 5, 10, 0.9)',
                border: '1px solid var(--color-primary-dim)',
                padding: '12px',
                zIndex: 100,
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.1)',
                backdropFilter: 'blur(4px)',
                fontFamily: 'monospace',
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.8 : 1,
                transition: isDragging ? 'none' : 'opacity 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                userSelect: 'none'
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: '1px solid var(--color-primary-dim)',
                paddingBottom: '8px',
                marginBottom: '10px',
                color: 'var(--color-accent)',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                letterSpacing: '1px'
            }}>
                <FileText size={14} />
                ARCHIVE // {storyData.length} FILES
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', minHeight: 0 }}>
                {storyData.map(doc => {
                    const isUnlocked = doc.unlockedByDefault || unlockedFiles.includes(doc.id);
                    return (
                        <div
                            key={doc.id}
                            style={{
                                border: '1px solid var(--color-primary-dim)',
                                backgroundColor: isUnlocked ? 'rgba(56, 163, 160, 0.08)' : 'transparent',
                                color: isUnlocked ? 'var(--color-text)' : 'var(--color-primary-dim)',
                                padding: '8px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                {isUnlocked ? <FileText size={12} /> : <Lock size={12} />}
                                <span style={{ fontSize: '0.68rem', fontWeight: 'bold' }}>{doc.name}</span>
                            </div>
                            <div style={{ fontSize: '0.62rem' }}>
                                {isUnlocked ? 'AVAILABLE IN TERMINAL' : 'ENCRYPTED'}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div
                onMouseDown={onResizeMouseDown}
                style={{
                    position: 'absolute',
                    right: '4px',
                    bottom: '4px',
                    width: '14px',
                    height: '14px',
                    cursor: 'nwse-resize',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-end',
                    color: isResizing ? 'var(--color-accent)' : 'var(--color-primary-dim)',
                    fontSize: '10px',
                    lineHeight: 1,
                    userSelect: 'none'
                }}
                title="Resize archive"
            >
                //
            </div>
        </div>
    );
};

export default PinnedArchive;
