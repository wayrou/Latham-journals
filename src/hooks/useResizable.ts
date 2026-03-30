import { useState, useCallback, useEffect, useRef } from 'react';

export const useResizable = (
    id: string,
    initialSize: { width: number; height: number },
    onResizeEnd: (id: string, width: number, height: number) => void,
    minSize: { width: number; height: number }
) => {
    const [size, setSize] = useState(initialSize);
    const [isResizing, setIsResizing] = useState(false);
    const startRef = useRef({ mouseX: 0, mouseY: 0, width: initialSize.width, height: initialSize.height });
    const hasResized = useRef(false);

    const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
        setIsResizing(true);
        startRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            width: size.width,
            height: size.height
        };
        e.preventDefault();
        e.stopPropagation();
    }, [size.height, size.width]);

    useEffect(() => {
        if (!isResizing) return;

        const onMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startRef.current.mouseX;
            const deltaY = e.clientY - startRef.current.mouseY;
            const nextWidth = Math.max(minSize.width, Math.min(window.innerWidth - 20, startRef.current.width + deltaX));
            const nextHeight = Math.max(minSize.height, Math.min(window.innerHeight - 20, startRef.current.height + deltaY));
            setSize({ width: nextWidth, height: nextHeight });
        };

        const onMouseUp = () => {
            setIsResizing(false);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isResizing, minSize.height, minSize.width]);

    useEffect(() => {
        if (isResizing) {
            hasResized.current = true;
        }

        if (!isResizing && hasResized.current) {
            onResizeEnd(id, size.width, size.height);
            hasResized.current = false;
        }
    }, [id, isResizing, onResizeEnd, size.height, size.width]);

    useEffect(() => {
        if (!isResizing) {
            setSize(initialSize);
        }
    }, [initialSize, isResizing]);

    return { size, isResizing, onResizeMouseDown };
};
