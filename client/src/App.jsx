import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import useStore from './store/useStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import Leaderboard from './pages/Leaderboard';
import api from './api/client';
import { useSocket } from './hooks/useSocket';

function PrivateRoute({ children }) {
  const accessToken = useStore((s) => s.accessToken);
  return accessToken ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const accessToken = useStore((s) => s.accessToken);
  return !accessToken ? children : <Navigate to="/rooms" replace />;
}

// Handles /join/:inviteCode — calls API then redirects to the room
function JoinRedirect() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    api.post(`/api/rooms/join/${inviteCode}`)
      .then(({ data }) => navigate(`/rooms/${data.room._id}`, { replace: true }))
      .catch(() => setError('Invalid or expired invite link.'));
  }, [inviteCode, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Joining room...</p>
    </div>
  );
}

export default function App() {
  useSocket();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/rooms" replace />} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      <Route path="/rooms" element={<PrivateRoute><Rooms /></PrivateRoute>} />
      <Route path="/rooms/:id" element={<PrivateRoute><RoomDetail /></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/calendar" element={<PrivateRoute><Calendar /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/leaderboard" element={<PrivateRoute><Leaderboard /></PrivateRoute>} />
      <Route path="/join/:inviteCode" element={<PrivateRoute><JoinRedirect /></PrivateRoute>} />
    </Routes>
  );
}
