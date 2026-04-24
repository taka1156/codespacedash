import { useAuth } from './hooks/useAuth';
import { DashboardPage } from './pages/DashboardPage/DashboardPage';
import { LoginPage } from './pages/LoginPage/LoginPage';

export default function App() {
  const { state, user, token, errorMsg, login, logout } = useAuth();

  if (state === 'authenticated' && user) {
    return <DashboardPage user={user} token={token} onLogout={logout} />;
  }

  return (
    <LoginPage
      onLogin={login}
      loading={state === 'loading'}
      errorMsg={errorMsg}
    />
  );
}
