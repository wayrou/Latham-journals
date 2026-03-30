import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Archive from './pages/Archive';
import TerminalPage from './pages/TerminalPage';
import Inbox from './pages/Inbox';
import Dungeon from './pages/Dungeon';
import { GameStateProvider, useGameState } from './context/GameStateContext';
import LockScreen from './components/LockScreen';
import BootSequence from './components/BootSequence';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
    errorStack: ''
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unknown application error.',
      errorStack: error.stack || ''
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('APP RENDER FAILURE', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#020406',
          color: 'var(--color-primary)',
          padding: '2rem',
          fontFamily: 'var(--font-mono, monospace)'
        }}>
          <div style={{
            maxWidth: '960px',
            margin: '0 auto',
            border: '1px solid var(--color-alert)',
            backgroundColor: 'rgba(255, 0, 0, 0.04)',
            padding: '1rem 1.25rem'
          }}>
            <h2 style={{ marginTop: 0, color: 'var(--color-alert)' }}>APPLICATION ERROR</h2>
            <p style={{ lineHeight: 1.5 }}>
              A runtime exception interrupted the post-boot app render. The message below should identify the failing component or state path.
            </p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--color-primary)' }}>
              {this.state.errorMessage}
            </pre>
            {this.state.errorStack && (
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--color-primary-dim)', opacity: 0.9 }}>
                {this.state.errorStack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const RootApp: React.FC = () => {
  const { isSystemUnlocked } = useGameState();
  const [hasBooted, setHasBooted] = useState(false);
  const handleBootComplete = React.useCallback(() => {
    setHasBooted(true);
  }, []);

  if (!isSystemUnlocked) {
    return <LockScreen />;
  }

  if (!hasBooted) {
    return <BootSequence onComplete={handleBootComplete} />;
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<TerminalPage />} />
            <Route path="archive" element={<Archive />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="dungeon" element={<Dungeon />} />
            <Route path="terminal" element={<TerminalPage />} />
            <Route path="*" element={<TerminalPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppErrorBoundary>
  );
};

import { DungeonProvider } from './context/DungeonContext';

const App: React.FC = () => {
  return (
    <GameStateProvider>
      <DungeonProvider>
        <RootApp />
      </DungeonProvider>
    </GameStateProvider>
  );
};

export default App;
