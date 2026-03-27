import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Archive from './pages/Archive';
import Timeline from './pages/Timeline';
import TerminalPage from './pages/TerminalPage';
import Inbox from './pages/Inbox';
import Dungeon from './pages/Dungeon';
import { GameStateProvider, useGameState } from './context/GameStateContext';
import LockScreen from './components/LockScreen';
import BootSequence from './components/BootSequence';

const RootApp: React.FC = () => {
  const { isSystemUnlocked } = useGameState();
  const [hasBooted, setHasBooted] = useState(false);

  if (!isSystemUnlocked) {
    return <LockScreen />;
  }

  if (!hasBooted) {
    return <BootSequence onComplete={() => setHasBooted(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<TerminalPage />} />
          <Route path="archive" element={<Archive />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="dungeon" element={<Dungeon />} />
          <Route path="terminal" element={<TerminalPage />} />
          <Route path="*" element={<TerminalPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

const App: React.FC = () => {
  return (
    <GameStateProvider>
      <RootApp />
    </GameStateProvider>
  );
};

export default App;
