import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './components/Toast';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { CreatePoll } from './pages/CreatePoll';
import { PollVote } from './pages/PollVote';
import { PollHost } from './pages/PollHost';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const { addToast } = useToast();

  // Simple and robust routing state with URL synchronization
  const [currentPage, setCurrentPage] = useState('home');
  const [activePollParam, setActivePollParam] = useState(null);

  // Sync route on mount and when browser back/forward buttons are used
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path.startsWith('/poll/')) {
        const identifier = path.replace('/poll/', '');
        setActivePollParam(identifier);
        setCurrentPage('vote');
      } else if (path.startsWith('/host/')) {
        const identifier = path.replace('/host/', '');
        setActivePollParam(identifier);
        setCurrentPage('host');
      } else if (path === '/dashboard') {
        setCurrentPage('dashboard');
      } else if (path === '/create') {
        setCurrentPage('create');
      } else if (path === '/login') {
        setCurrentPage('login');
      } else if (path === '/register') {
        setCurrentPage('register');
      } else {
        setCurrentPage('home');
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (page, param = null) => {
    setCurrentPage(page);
    setActivePollParam(param);

    // Update browser URL
    let newPath = '/';
    if (page === 'vote' && param) newPath = `/poll/${param}`;
    else if (page === 'host' && param) newPath = `/host/${param}`;
    else if (page === 'dashboard') newPath = '/dashboard';
    else if (page === 'create') newPath = '/create';
    else if (page === 'login') newPath = '/login';
    else if (page === 'register') newPath = '/register';

    window.history.pushState({}, '', newPath);
    window.scrollTo(0, 0);
  };

  const handleJoinPoll = (code) => {
    navigate('vote', code);
  };

  const handleSelectPoll = (poll, mode) => {
    if (mode === 'host') {
      navigate('host', poll.id);
    } else {
      navigate('vote', poll.code || poll.id);
    }
  };

  const handlePollCreated = (createdPoll) => {
    navigate('host', createdPoll.id);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'var(--text-secondary)'
      }}>
        Initializing LivePoll...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onNavigate={navigate} currentPage={currentPage} />

      <main className="app-container main-content" style={{ flex: 1 }}>
        {currentPage === 'home' && (
          <Home onNavigate={navigate} onJoinPoll={handleJoinPoll} />
        )}

        {currentPage === 'login' && (
          <Login onNavigate={navigate} />
        )}

        {currentPage === 'register' && (
          <Register onNavigate={navigate} />
        )}

        {currentPage === 'dashboard' && (
          isAuthenticated ? (
            <Dashboard onNavigate={navigate} onSelectPoll={handleSelectPoll} />
          ) : (
            <Login onNavigate={navigate} />
          )
        )}

        {currentPage === 'create' && (
          isAuthenticated ? (
            <CreatePoll onNavigate={navigate} onPollCreated={handlePollCreated} />
          ) : (
            <Login onNavigate={navigate} />
          )
        )}

        {currentPage === 'vote' && activePollParam && (
          <PollVote
            pollIdentifier={activePollParam}
            onBack={() => navigate('home')}
          />
        )}

        {currentPage === 'host' && activePollParam && (
          <PollHost
            pollIdentifier={activePollParam}
            onBack={() => navigate(isAuthenticated ? 'dashboard' : 'home')}
          />
        )}
      </main>

      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '1.75rem 2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
      }}>
        <div>LivePoll • Built with React, Go (Gin), MongoDB, and Redis</div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
