import { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import Hero from './components/Hero';
import Leaderboard from './components/Leaderboard';
import RecentMatches from './components/RecentMatches';
import DailyRewards from './components/DailyRewards';
import ProfilePage from './components/ProfilePage';
import LeaderboardPage from './components/LeaderboardPage';
import RewardsPage from './components/RewardsPage';
import SettingsPage from './components/SettingsPage';
import FriendsPage from './components/FriendsPage';
import MatchmakingPage from './components/MatchmakingPage';
import AuthPage from './components/AuthPage';
import NotFoundPage from './components/NotFoundPage';
import Footer from './components/Footer';

interface User {
  id: string;
  username: string;
  avatar: string;
}

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Discord OAuth callback-ыг шалгах
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const username = params.get('username');
    const avatar = params.get('avatar');

    if (id && username) {
      const userData = { id, username, avatar: avatar || '' };
      setUser(userData);
      setIsAuthenticated(true);
      
      // Save to localStorage for persistence
      localStorage.setItem('user', JSON.stringify(userData));
      
      // URL-ыг цэвэрлэх (Гоё харагдуулахын тулд)
      window.history.replaceState({}, document.title, "/");
    } else {
      // Check if user is already logged in (from localStorage)
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setIsAuthenticated(true);
        } catch (e) {
          // Invalid data, clear it
          localStorage.removeItem('user');
        }
      }
    }
  }, []);

  const handleFindMatch = () => {
    setCurrentPage('matchmaking');
  };

  const handleAuth = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleGoHome = () => {
    setCurrentPage('home');
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    setCurrentPage('home');
  };

  // Check if current page is valid
  const validPages = ['home', 'profile', 'leaderboard', 'rewards', 'settings', 'friends', 'matchmaking'];
  const isValidPage = validPages.includes(currentPage);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Show 404 page if page is not valid
  if (!isValidPage) {
    return <NotFoundPage onGoHome={handleGoHome} />;
  }

  return (
    <div className="app">
      <Header 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        onLogout={handleLogout}
      />
      
      <main className="main-content">
        {currentPage === 'home' && (
          <>
            <Hero onFindMatch={handleFindMatch} />
            <div className="content-grid">
              <Leaderboard />
              <RecentMatches />
              <DailyRewards />
            </div>
          </>
        )}

        {currentPage === 'profile' && <ProfilePage onFindMatch={handleFindMatch} />}
        {currentPage === 'leaderboard' && <LeaderboardPage />}
        {currentPage === 'rewards' && <RewardsPage />}
        {currentPage === 'settings' && <SettingsPage />}
        {currentPage === 'friends' && <FriendsPage />}
        {currentPage === 'matchmaking' && <MatchmakingPage onCancel={() => setCurrentPage('home')} />}
      </main>

      <Footer />
    </div>
  );
}

export default App;
