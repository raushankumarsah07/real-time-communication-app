import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Room from './pages/Room.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="center muted pad">Loading…</p>;
  // remember where they were going (e.g. a meeting link) so login can return them there
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export default function App() {
  const { user } = useAuth();
  const location = useLocation();
  const back = location.state?.from || '/';

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={back} replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to={back} replace /> : <AuthPage mode="register" />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/room/:code" element={<Protected><Room /></Protected>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
