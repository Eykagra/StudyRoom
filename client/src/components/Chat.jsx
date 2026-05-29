import { useState, useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import useStore from '../store/useStore';
import { getSocket } from '../hooks/useSocket';
import api from '../api/client';

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Consistent avatar color per user based on their name
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500',
];
function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ name, size = 'sm' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
  return (
    <div className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center font-medium text-white shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

export default function Chat({ roomId }) {
  const user = useStore((s) => s.user);
  const messages = useStore((s) => s.messages[roomId] || []);
  const setMessages = useStore((s) => s.setMessages);
  const addMessage = useStore((s) => s.addMessage);
  const reconcileMessage = useStore((s) => s.reconcileMessage);

  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['messages', roomId],
    queryFn: ({ pageParam }) => {
      const params = { limit: 50 };
      if (pageParam) params.before = pageParam;
      return api.get(`/api/rooms/${roomId}/messages`, { params }).then((r) => r.data);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
  });

  useEffect(() => {
    if (!data) return;
    const all = data.pages.flatMap((p) => p.messages);
    setMessages(roomId, all);
  }, [data, roomId, setMessages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessage = ({ message }) => addMessage(roomId, message);
    const onMessageSaved = ({ tempId, message }) => reconcileMessage(roomId, tempId, message);
    const onTyping = ({ userId: uid, name }) => {
      if (uid === user?.id) return;
      setTypingUsers((prev) => prev.find((u) => u.userId === uid) ? prev : [...prev, { userId: uid, name }]);
    };
    const onTypingStop = ({ userId: uid }) => setTypingUsers((prev) => prev.filter((u) => u.userId !== uid));

    socket.on('chat:message', onMessage);
    socket.on('chat:message_saved', onMessageSaved);
    socket.on('chat:typing', onTyping);
    socket.on('chat:typing_stop', onTypingStop);

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:message_saved', onMessageSaved);
      socket.off('chat:typing', onTyping);
      socket.off('chat:typing_stop', onTypingStop);
    };
  }, [roomId, user?.id, addMessage, reconcileMessage]);

  // Only auto-scroll if user is near the bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, typingUsers.length]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('chat:send', { roomId, content });
    setInput('');
    isNearBottomRef.current = true;
    if (isTypingRef.current) {
      socket.emit('typing:stop', { roomId });
      isTypingRef.current = false;
    }
    clearTimeout(typingTimerRef.current);
  }, [input, roomId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const socket = getSocket();
    if (!socket) return;
    if (!isTypingRef.current) {
      socket.emit('typing:start', { roomId });
      isTypingRef.current = true;
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing:stop', { roomId });
      isTypingRef.current = false;
    }, 2000);
  };

  // Group consecutive messages from the same sender
  // Extract sender ID defensively — DB messages have _id, temp messages may have id
  const getSenderId = (msg) =>
    msg.user?._id?.toString() || msg.user?.id?.toString() || '';

  const grouped = messages.map((msg, i) => {
    const senderId = getSenderId(msg);
    const prevSenderId = i > 0 ? getSenderId(messages[i - 1]) : null;
    const nextSenderId = i < messages.length - 1 ? getSenderId(messages[i + 1]) : null;
    return {
      ...msg,
      isFirst: senderId !== prevSenderId,
      isLast: senderId !== nextSenderId,
    };
  });

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 min-h-0 space-y-0.5"
      >
        {hasNextPage && (
          <div className="text-center py-2 mb-2">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs text-muted hover:text-zinc-300 transition-colors bg-surface-2 px-3 py-1 rounded-full"
            >
              {isFetchingNextPage ? 'Loading...' : '↑ Load earlier messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="text-2xl">💬</span>
            <p className="text-muted text-sm">No messages yet.</p>
            <p className="text-zinc-600 text-xs">Be the first to say something!</p>
          </div>
        )}

        {grouped.map((msg) => {
          const senderId = getSenderId(msg);
          const isOwn = !!senderId && senderId === user?.id;
          const name = isOwn ? 'You' : (msg.user?.name ?? 'Unknown');

          return (
            <div
              key={msg._id}
              className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${msg.isFirst ? 'mt-3' : 'mt-0.5'}`}
            >
              {/* Avatar — only for others, only on last message in group */}
              {!isOwn && (
                <div className="w-7 shrink-0 mb-0.5">
                  {msg.isLast ? <Avatar name={name} /> : null}
                </div>
              )}

              <div className={`flex flex-col gap-0.5 max-w-[68%] ${isOwn ? 'items-end' : 'items-start'}`}>
                {/* Sender name — others: left-aligned, own: "You" right-aligned */}
                {msg.isFirst && (
                  <span className={`text-xs font-medium ${isOwn ? 'text-accent/70 mr-1' : 'text-zinc-400 ml-1'}`}>
                    {name}
                  </span>
                )}

                {/* Bubble */}
                <div
                  className={`px-3.5 py-2 text-sm leading-relaxed break-words ${
                    isOwn
                      ? 'bg-accent text-white rounded-2xl rounded-br-md'
                      : 'bg-surface-2 text-zinc-100 rounded-2xl rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Timestamp — only on last in group */}
                {msg.isLast && (
                  <span className={`text-xs text-zinc-600 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                    {formatTime(msg.createdAt)}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 mt-3 ml-9">
            <div className="bg-surface-2 rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-zinc-500">
              {typingUsers.map((u) => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            className="input resize-none flex-1 min-h-[40px] max-h-28 py-2.5 leading-relaxed"
            placeholder="Message..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="btn-primary h-10 w-10 flex items-center justify-center shrink-0 rounded-xl disabled:opacity-30"
            aria-label="Send message"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-zinc-700 mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
