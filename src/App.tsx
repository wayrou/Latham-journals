import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Archive from './pages/Archive';
import Timeline from './pages/Timeline';
import About from './pages/About';
import TerminalPage from './pages/TerminalPage';
import { GameStateProvider } from './context/GameStateContext';

const App: React.FC = () => {
  return (
    <GameStateProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="archive" element={<Archive />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="about" element={<About />} />
            <Route path="terminal" element={<TerminalPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GameStateProvider>
  );
};

export default App;
