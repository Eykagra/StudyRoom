function pad(n) {
  return String(n).padStart(2, '0');
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function Timer({ elapsed, status }) {
  const isActive = status === 'ACTIVE';
  const isPaused = status === 'PAUSED';

  return (
    <div className="text-center">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">
        Session time
      </p>
      <p className="text-5xl font-bold tabular-nums tracking-tight text-zinc-100 mb-1">
        {formatElapsed(elapsed)}
      </p>
      <div className="flex items-center justify-center gap-1.5 mt-1">
        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : isPaused ? 'bg-yellow-400' : 'bg-zinc-600'}`} />
        <span className={`text-xs font-medium ${isActive ? 'text-emerald-400' : isPaused ? 'text-yellow-400' : 'text-zinc-500'}`}>
          {isActive ? 'Focus mode' : isPaused ? 'Paused' : 'Ready to start'}
        </span>
      </div>
    </div>
  );
}
