export default function SessionControls({ status, onStart, onPause, onResume, onEnd }) {
  return (
    <div className="flex items-center justify-center gap-3 mt-5">
      {status === 'IDLE' && (
        <button onClick={onStart} className="btn-primary px-8 py-2.5 rounded-xl text-sm font-semibold">
          ▶ Start session
        </button>
      )}

      {status === 'ACTIVE' && (
        <>
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:bg-surface-2 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
            Pause
          </button>
          <button
            onClick={onEnd}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
          >
            End session
          </button>
        </>
      )}

      {status === 'PAUSED' && (
        <>
          <button onClick={onResume} className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold">
            ▶ Resume
          </button>
          <button
            onClick={onEnd}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
          >
            End session
          </button>
        </>
      )}
    </div>
  );
}
