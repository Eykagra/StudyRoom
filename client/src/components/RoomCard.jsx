import { useNavigate } from 'react-router-dom';

export default function RoomCard({ room }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/rooms/${room._id}`)}
      className="card w-full text-left hover:border-zinc-600 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-zinc-100 truncate group-hover:text-white transition-colors">
            {room.name}
          </h3>
          {room.description && (
            <p className="text-sm text-muted mt-0.5 truncate">{room.description}</p>
          )}
        </div>
        {room.role === 'OWNER' && (
          <span className="shrink-0 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">
            Owner
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-600 mt-3">
        Created {new Date(room.createdAt).toLocaleDateString()}
      </p>
    </button>
  );
}
