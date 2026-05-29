// ── Notification preferences ───────────────────────────────────
const DEFAULTS = {
  roomInvitations: true,
  sessionStart: true,
  sessionEnd: true,
  newMessages: true,
  memberUpdates: true,
  pushNotifications: true,
  sound: false,
};

export function getNotifPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('notifPrefs') || '{}') };
  } catch {
    return DEFAULTS;
  }
}

// ── Browser Notification API ───────────────────────────────────
let permissionGranted = Notification?.permission === 'granted';

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') { permissionGranted = true; return true; }
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  permissionGranted = result === 'granted';
  return permissionGranted;
}

export function showBrowserNotification(title, body, onClick) {
  const prefs = getNotifPrefs();
  if (!prefs.pushNotifications || !permissionGranted) return;
  if (!('Notification' in window)) return;

  const notif = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: `studyroom-${Date.now()}`,
  });

  if (onClick) {
    notif.onclick = () => {
      window.focus();
      onClick();
      notif.close();
    };
  }

  setTimeout(() => notif.close(), 5000);
}

// ── Sound ──────────────────────────────────────────────────────
// Simple beep using Web Audio API — no external file needed
let audioCtx = null;

export function playNotificationSound() {
  const prefs = getNotifPrefs();
  if (!prefs.sound) return;

  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

// ── Notify helper — checks prefs and fires both push + sound ───
export function notify(type, title, body, onClick) {
  const prefs = getNotifPrefs();

  // Map notification type to preference key
  const typeMap = {
    sessionStart: 'sessionStart',
    sessionEnd: 'sessionEnd',
    newMessage: 'newMessages',
    memberJoined: 'memberUpdates',
    memberLeft: 'memberUpdates',
    roomInvitation: 'roomInvitations',
    roomDeleted: 'roomInvitations',
  };

  const prefKey = typeMap[type];
  if (prefKey && !prefs[prefKey]) return; // User disabled this type

  showBrowserNotification(title, body, onClick);
  playNotificationSound();
}
