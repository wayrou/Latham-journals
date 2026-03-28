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
