import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook to make a fixed-position element draggable with grid snapping.
 * @param id Unique identifier for the element (for state persistence)
 * @param initialPos The initial {x, y} position
 * @param onDragEnd Callback when the drag operation finishes
 * @param gridSize The size of the snapping grid (default: 20)
 */
export const useDraggable = (
    id: string, 
    initialPos: { x: number; y: number }, 
    onDragEnd: (id: string, x: number, y: number) => void,
    gridSize: number = 20
) => {
    const [pos, setPos] = useState(initialPos);
    const [isDragging, setIsDragging] = useState(false);
    
    // Use refs for values that change during drag to avoid excessive re-renders/stale closures
    const dragOffset = useRef({ x: 0, y: 0 });

    const snap = useCallback((val: number) => Math.round(val / gridSize) * gridSize, [gridSize]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        // Prevent dragging if clicking on a button, input, or other interactive element
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.closest('button')) {
            return;
        }

        setIsDragging(true);
        dragOffset.current = { 
            x: e.clientX - pos.x, 
            y: e.clientY - pos.y 
        };
        
        e.preventDefault();
        e.stopPropagation();
    }, [pos.x, pos.y]);

    useEffect(() => {
        if (!isDragging) return;

        const onMouseMove = (e: MouseEvent) => {
            const rawX = e.clientX - dragOffset.current.x;
            const rawY = e.clientY - dragOffset.current.y;
            
            // Constrain to window bounds (basic)
            const boundedX = Math.max(0, Math.min(window.innerWidth - 100, rawX));
            const boundedY = Math.max(0, Math.min(window.innerHeight - 50, rawY));

            setPos({ 
                x: snap(boundedX), 
                y: snap(boundedY) 
            });
        };

        const onMouseUp = () => {
            setIsDragging(false);
            // We use the last captured state for position
            // But setPos is async, so we use the functional update pattern or just trust the next render
            // Actually, inside the effect, we want the LATEST pos. 
            // Since we're in the effect, we have access to the closure's 'pos' which is updated by setPos.
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging, snap]);

    const hasDragged = useRef(false);

    // Sync state to persistent storage ONLY when dragging ends
    useEffect(() => {
        if (isDragging) {
            hasDragged.current = true;
        }

        if (!isDragging && hasDragged.current) {
            onDragEnd(id, pos.x, pos.y);
            hasDragged.current = false;
        }
    }, [isDragging, id, onDragEnd, pos.x, pos.y]);

    // Update internal position if the external initialPos changes (e.g. from global state refresh)
    useEffect(() => {
        if (!isDragging) {
            setPos(initialPos);
        }
    }, [initialPos, isDragging]);

    return { pos, isDragging, onMouseDown };
};
