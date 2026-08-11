import { useState } from 'react';
import { StoreProvider, useStore } from './store';
import { ToastProvider } from './components/Toast';
import Sidebar from './components/Sidebar';
import TodayPage from './pages/TodayPage';
import ProjectsPage from './pages/ProjectsPage';
import ShotsPage from './pages/ShotsPage';
import StatusPage from './pages/StatusPage';
import ETAPage from './pages/ETAPage';
import ArtistsPage from './pages/ArtistsPage';
import './App.css';
import LoginPage from './pages/LoginPage';

function AppContent() {
  const { state } = useStore();

  const renderPage = () => {
    switch (state.activeTab) {
      case 'today':    return <TodayPage />;
      case 'projects': return <ProjectsPage />;
      case 'shots':    return <ShotsPage />;
      case 'status':   return <StatusPage />;
      case 'eta':      return <ETAPage />;
      case 'artists':  return <ArtistsPage />;
      default:         return <TodayPage />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        {renderPage()}
      </main>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('vfx-auth') === 'true';
  });

  const handleLogin = () => {
    sessionStorage.setItem('vfx-auth', 'true');
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <StoreProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </StoreProvider>
  );
}
