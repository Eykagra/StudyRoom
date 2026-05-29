import { create } from 'zustand';

// Persist auth to sessionStorage so refreshes and new-tab navigations
// (e.g. pasting an invite link) don't lose the session.
// sessionStorage is cleared when the browser session ends (tab/window close).
function normalizeUser(user) {
  if (!user) return null;
  return { ...user, id: user.id || user._id?.toString() };
}

function loadAuth() {
  try {
    const raw = sessionStorage.getItem('auth');
    if (!raw) return { user: null, accessToken: null };
    const parsed = JSON.parse(raw);
    // Normalize on load so stale sessionStorage entries get fixed too
    return { user: normalizeUser(parsed.user), accessToken: parsed.accessToken };
  } catch {
    return { user: null, accessToken: null };
  }
}

function saveAuth(user, accessToken) {
  try {
    sessionStorage.setItem('auth', JSON.stringify({ user, accessToken }));
  } catch {}
}

function clearAuth() {
  try {
    sessionStorage.removeItem('auth');
  } catch {}
}

const { user: savedUser, accessToken: savedToken } = loadAuth();

const useStore = create((set) => ({
  // ── Auth ──────────────────────────────────────────────────────
  user: savedUser,
  accessToken: savedToken,

  setAuth: (user, accessToken) => {
    const normalized = normalizeUser(user);
    saveAuth(normalized, accessToken);
    set({ user: normalized, accessToken });
  },

  setToken: (accessToken) => {
    // Update token in storage while keeping existing user
    const { user } = loadAuth();
    saveAuth(user, accessToken);
    set({ accessToken });
  },

  clearAuth: () => {
    clearAuth();
    set({ user: null, accessToken: null });
  },

  // ── Presence ──────────────────────────────────────────────────
  // onlineUsers: { [roomId]: [{ id, name, focusStatus, focusElapsed }] }
  onlineUsers: {},

  setOnlineUsers: (roomId, users) =>
    set((s) => ({ onlineUsers: { ...s.onlineUsers, [roomId]: users } })),

  addOnlineUser: (roomId, user) =>
    set((s) => {
      const current = s.onlineUsers[roomId] || [];
      if (current.find((u) => u.id === user.id)) return s;
      return { onlineUsers: { ...s.onlineUsers, [roomId]: [...current, { ...user, focusStatus: 'online', focusElapsed: 0 }] } };
    }),

  updateOnlineUsers: (roomId, users) =>
    set((s) => ({ onlineUsers: { ...s.onlineUsers, [roomId]: users } })),

  removeOnlineUser: (roomId, userId) =>
    set((s) => ({
      onlineUsers: {
        ...s.onlineUsers,
        [roomId]: (s.onlineUsers[roomId] || []).filter((u) => u.id !== userId),
      },
    })),

  // ── Messages ──────────────────────────────────────────────────
  messages: {},

  setMessages: (roomId, messages) =>
    set((s) => ({ messages: { ...s.messages, [roomId]: messages } })),

  prependMessages: (roomId, older) =>
    set((s) => ({
      messages: { ...s.messages, [roomId]: [...older, ...(s.messages[roomId] || [])] },
    })),

  addMessage: (roomId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [roomId]: [...(s.messages[roomId] || []), message],
      },
    })),

  reconcileMessage: (roomId, tempId, message) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [roomId]: (s.messages[roomId] || []).map((m) =>
          m._id === tempId ? message : m
        ),
      },
    })),
}));

export default useStore;
