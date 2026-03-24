import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface GameState {
    unlockedFiles: string[];
    clearanceLevel: number;
}

interface GameStateContextType extends GameState {
    unlockFile: (fileId: string) => void;
    setClearance: (level: number) => void;
    resetGame: () => void;
}

const defaultState: GameState = {
    unlockedFiles: [],
    clearanceLevel: 1,
};

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export const GameStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [gameState, setGameState] = useState<GameState>(() => {
        const saved = localStorage.getItem('latham_journals_state');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return defaultState;
            }
        }
        return defaultState;
    });

    useEffect(() => {
        localStorage.setItem('latham_journals_state', JSON.stringify(gameState));
    }, [gameState]);

    const unlockFile = (fileId: string) => {
        setGameState(prev => {
            if (prev.unlockedFiles.includes(fileId)) return prev;
            return {
                ...prev,
                unlockedFiles: [...prev.unlockedFiles, fileId],
            };
        });
    };

    const setClearance = (level: number) => {
        setGameState(prev => ({ ...prev, clearanceLevel: level }));
    };

    const resetGame = () => {
        setGameState(defaultState);
    };

    return (
        <GameStateContext.Provider value={{ ...gameState, unlockFile, setClearance, resetGame }}>
            {children}
        </GameStateContext.Provider>
    );
};

export const useGameState = () => {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error('useGameState must be used within a GameStateProvider');
    }
    return context;
};
