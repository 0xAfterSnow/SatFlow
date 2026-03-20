import React, { useState } from 'react';
import { SatFlowProvider } from './context/SatFlowContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { DepositPage } from './pages/DepositPage';
import { DashboardPage } from './pages/DashboardPage';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('landing');

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />
      <main style={{ flex: 1 }}>
        {currentPage === 'landing' && <LandingPage onNavigate={handleNavigate} />}
        {currentPage === 'deposit' && <DepositPage onNavigate={handleNavigate} />}
        {currentPage === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
      </main>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SatFlowProvider>
        <AppContent />
      </SatFlowProvider>
    </ThemeProvider>
  );
}

export default App;
