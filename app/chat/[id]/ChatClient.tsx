"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Send, CornerUpLeft, X, MapPin, ArrowDown, Trash2, Pin, LogOut, BarChart3, SmilePlus, MoreVertical } from "lucide-react";
import { joinConversation, sendMessage, updateLastRead, toggleReaction, deleteMessage, pinMessage, leaveConversation, setConversationLocation } from "@/app/actions/chat";
import { createPoll, votePoll } from "@/app/actions/polls";
import { getPlacePredictions } from "@/app/actions/places";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useAlert } from "@/components/AlertProvider";

const EMOJI_OPTIONS = ['👍', '❤️', '🔥', '😂', '😢', '🎉'];

function renderMessageText(text: string, isMine: boolean = false) {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const name = match[1];
    const address = match[2];
    parts.push(
      <button 
        key={match.index}
        type="button"
        onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')}
        style={{
          fontWeight: 700,
          color: isMine ? '#FFFFFF' : '#4F46E5',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          verticalAlign: 'baseline',
          margin: '0 2px',
          maxWidth: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: 'inherit',
        }}
        title={address}
      >
        <MapPin style={{ width: '14px', height: '14px', display: 'inline', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      </button>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

type Reaction = { emoji: string; userId: string };
type PollData = { question: string; creatorId: string; options: { id: number; text: string; votes: { userId: string }[] }[] };
type ReadReceipt = { userId: string; name: string; avatar: string | null; lastReadAt: Date };

type Message = {
  id: number;
  userId: string;
  text: string;
  messageType?: string;
  createdAt: Date;
  senderName: string;
  avatar?: string | null;
  replyToId?: number | null;
  reactions?: Reaction[];
};

export default function ChatClient({ 
  conversationId, 
  initialMessages, 
  hasJoined,
  currentUserId,
  currentUserAvatar,
  participantMap,
  pinnedMessage,
  pollsMap,
  readReceipts,
  creatorId,
}: { 
  conversationId: number, 
  initialMessages: Message[], 
  hasJoined: boolean,
  currentUserId: string,
  currentUserAvatar: string | null,
  participantMap: Record<string, { name: string, avatar: string | null }>,
  pinnedMessage?: { id: number; text: string; senderName: string } | null,
  pollsMap?: Record<number, PollData>,
  readReceipts?: ReadReceipt[],
  creatorId?: string,
}) {
  const [isJoined, setIsJoined] = useState(hasJoined);
  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>(initialMessages);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<{ name: string; address: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showNewBadge, setShowNewBadge] = useState(false);

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msgId: number; x: number; y: number } | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionInputs, setPollOptionInputs] = useState(["" , ""]);
  const { showAlert } = useAlert();

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`realtime:conversation:${conversationId}`, {
      config: { presence: { key: currentUserId } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing: string[] = [];
        for (const id in state) {
          for (const presence of state[id] as any[]) {
            if (presence.isTyping && presence.userId !== currentUserId) {
              typing.push(presence.userName);
            }
          }
        }
        setTypingUsers(Array.from(new Set(typing)));
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
        },
        (payload) => {
          if (payload.table === "messages" && payload.eventType === "INSERT") {
            // If message is from someone else, add it optimistically
            if (payload.new.conversation_id === conversationId && payload.new.user_id !== currentUserId) {
              const incomingMsg: Message = {
                id: payload.new.id,
                userId: payload.new.user_id,
                text: payload.new.text,
                messageType: payload.new.message_type,
                createdAt: new Date(payload.new.created_at),
                senderName: participantMap[payload.new.user_id]?.name || "Member",
                avatar: participantMap[payload.new.user_id]?.avatar || null,
                replyToId: payload.new.reply_to_id || null,
                reactions: [],
              };
              setOptimisticMessages(prev => {
                if (prev.find(m => m.id === incomingMsg.id)) return prev;
                return [...prev, incomingMsg];
              });
            }
          } else {
            // For updates (deletions), reactions, poll votes, or pinned messages
            router.refresh();
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ isTyping: false, userId: currentUserId, userName: participantMap[currentUserId]?.name || "Member" });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, participantMap, supabase]);

  // Mark messages as read
  useEffect(() => {
    if (currentUserId && hasJoined) {
      updateLastRead(conversationId).catch(console.error);
    }
  }, [optimisticMessages.length, currentUserId, hasJoined, conversationId]);

  // Sync state if props change (revalidation)
  useEffect(() => {
    setOptimisticMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setIsJoined(hasJoined);
  }, [hasJoined]);

  // Handle Mentions
  useEffect(() => {
    // Match "@" followed by text at the end of the string, ensuring it's preceded by space or start
    const match = /(?:^|\s)@([a-zA-Z0-9\s,]*)$/.exec(message);
    
    // Request location silently when user starts typing an @
    if (match && !coords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // ignore error if denied
      );
    }

    if (match) {
      const query = match[1];
      setMentionQuery(query);
      if (query.trim().length > 0) {
        const timer = setTimeout(async () => {
          const suggestions = await getPlacePredictions(query, coords?.lat, coords?.lng);
          setMentionSuggestions(suggestions);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        setMentionSuggestions([]);
      }
    } else {
      setMentionQuery(null);
      setMentionSuggestions([]);
    }
  }, [message, coords]);

  const handleMentionSelect = (suggestion: any) => {
    const placeName = suggestion.mainText;
    const fullAddress = suggestion.mainText + (suggestion.secondaryText ? `, ${suggestion.secondaryText}` : "");
    // Replace the trailing @... with the place name and a zero-width space (\u200B)
    // This breaks the regex match on subsequent keystrokes so the dropdown doesn't stay open
    const newMessage = message.replace(/(^|\s)@([a-zA-Z0-9\s,]*)$/, `$1@${placeName}\u200B `);
    setMessage(newMessage);
    setSelectedMentions(prev => [...prev, { name: placeName, address: fullAddress }]);
    setMentionQuery(null);
    setMentionSuggestions([]);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const isScrolledUp = container.scrollHeight - container.scrollTop - container.clientHeight > 100;
    
    if (isScrolledUp && optimisticMessages[optimisticMessages.length - 1]?.userId !== currentUserId) {
      setShowNewBadge(true);
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [optimisticMessages]);

  const handleJoin = async () => {
    setIsJoined(true);
    startTransition(async () => {
      const res = await joinConversation(conversationId);
      if (res?.error) {
        alert(res.error);
        setIsJoined(false);
      }
    });
  };

  const handleLeave = () => {
    showAlert({
      title: "Leave Plan",
      message: "Are you sure you want to leave this plan? You won't receive any more updates.",
      type: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const res = await leaveConversation(conversationId);
          if (res?.error) {
            showAlert({ title: "Error", message: res.error, type: "info" });
          } else {
            router.push('/');
          }
        });
      }
    });
  };

  const handleReaction = async (messageId: number, emoji: string) => {
    setActiveEmojiPicker(null);
    setContextMenu(null);
    // Optimistic reaction update handled via realtime sync (router.refresh())
    // for simplicity and reliability right now
    startTransition(async () => {
      const res = await toggleReaction(messageId, emoji);
      if (res?.error) showAlert({ title: "Error", message: res.error, type: "info" });
    });
  };

  const handleDelete = (messageId: number) => {
    setContextMenu(null);
    showAlert({
      title: "Delete message",
      message: "Are you sure you want to delete this message? This action cannot be undone.",
      type: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const res = await deleteMessage(messageId);
          if (res?.error) showAlert({ title: "Error", message: res.error, type: "info" });
        });
      }
    });
  };

  const handlePin = async (messageId: number) => {
    setContextMenu(null);
    startTransition(async () => {
      const res = await pinMessage(conversationId, messageId);
      if (res?.error) showAlert({ title: "Error", message: res.error, type: "info" });
    });
  };

  const handleUnpin = () => {
    setContextMenu(null);
    showAlert({
      title: "Unpin message",
      message: "Are you sure you want to unpin this message?",
      type: "confirm",
      onConfirm: () => {
        startTransition(async () => {
          const res = await pinMessage(conversationId, null);
          if (res?.error) showAlert({ title: "Error", message: res.error, type: "info" });
        });
      }
    });
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim()) return alert("Question is required");
    const validOptions = pollOptionInputs.filter(o => o.trim());
    if (validOptions.length < 2) return alert("At least 2 options required");
    
    setShowPollCreator(false);
    setPollQuestion("");
    setPollOptionInputs(["", ""]);
    
    startTransition(async () => {
      const res = await createPoll(conversationId, pollQuestion, validOptions);
      if (res?.error) alert(res.error);
    });
  };

  const handleVotePoll = async (optionId: number) => {
    startTransition(async () => {
      const res = await votePoll(optionId);
      if (res?.error) alert(res.error);
    });
  };

  const handleType = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Broadcast typing
    if (channelRef.current) {
      channelRef.current.track({ isTyping: true, userId: currentUserId, userName: participantMap[currentUserId]?.name || "Member" });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.track({ isTyping: false, userId: currentUserId, userName: participantMap[currentUserId]?.name || "Member" });
      }, 2000);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isPending) return;

    let finalMessage = message.trim();
    
    // Convert selected mentions to markdown format
    selectedMentions.forEach(mention => {
      // Escape name for regex
      const escapedName = mention.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`@${escapedName}(\\u200B)?`, 'g');
      finalMessage = finalMessage.replace(regex, `@[${mention.name}](${mention.address})`);
    });
    
    const textToSend = finalMessage;
    setMessage(""); // clear input instantly
    setSelectedMentions([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Optimistic UI
    const newMsg: Message = {
      id: Math.random(),
      userId: currentUserId,
      text: textToSend,
      createdAt: new Date(),
      senderName: "You",
      avatar: currentUserAvatar,
      replyToId: replyingTo?.id || null,
    };
    
    const currentReplyToId = replyingTo?.id;
    setReplyingTo(null);
    setOptimisticMessages(prev => [...prev, newMsg]);

    startTransition(async () => {
      const res = await sendMessage(conversationId, textToSend, currentReplyToId);
      if (res?.error) {
        alert(res.error);
        setOptimisticMessages(prev => prev.filter(m => m.id !== newMsg.id));
      }
    });
  };

  // Format time helper
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(date));
  };

  const groupedMessages: Record<string, Message[]> = {};
  optimisticMessages.forEach(msg => {
    const dateStr = new Intl.DateTimeFormat("en-US", { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(msg.createdAt));
    if (!groupedMessages[dateStr]) groupedMessages[dateStr] = [];
    groupedMessages[dateStr].push(msg);
  });

  const handleSetLocation = async (name: string, address: string) => {
    startTransition(async () => {
      const res = await setConversationLocation(conversationId, address);
      if (res?.error) {
        showAlert({ title: "Error", message: res.error });
      } else {
        showAlert({ title: "Location Updated", message: `The plan location has been set to ${name}.` });
      }
    });
  };

  const formatGroupDate = (dateStr: string) => {
    const msgDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (msgDate.toDateString() === today.toDateString()) return "Today";
    if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";
    return dateStr;
  };

  return (
    <>
      {/* Poll Creator Modal */}
      {showPollCreator && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-[#111827] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#4F46E5]"/> Create a Poll
              </h3>
              <button type="button" onClick={() => setShowPollCreator(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1.5">
                <X className="w-4 h-4"/>
              </button>
            </div>
            <input 
              type="text" 
              placeholder="Ask a question..." 
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value)}
              className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl px-4 py-3 text-[15px] mb-4 outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all"
            />
            <div className="space-y-2.5 mb-4 max-h-[40vh] overflow-y-auto hide-scrollbar">
              {pollOptionInputs.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    placeholder={`Option ${i + 1}`} 
                    value={opt}
                    onChange={e => {
                      const newOpts = [...pollOptionInputs];
                      newOpts[i] = e.target.value;
                      setPollOptionInputs(newOpts);
                    }}
                    className="flex-1 bg-[#F9FAFB] border border-gray-200 rounded-xl px-4 py-2.5 text-[15px] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all"
                  />
                  {pollOptionInputs.length > 2 && (
                    <button type="button" onClick={() => setPollOptionInputs(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptionInputs.length < 6 && (
              <button type="button" onClick={() => setPollOptionInputs(prev => [...prev, ""])} className="text-[13px] font-semibold text-[#4F46E5] mb-5 hover:underline flex items-center gap-1">
                + Add option
              </button>
            )}
            <button type="button" onClick={handleCreatePoll} className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-3.5 rounded-xl text-[15px] transition-colors shadow-md shadow-[#4F46E5]/20">
              Send Poll
            </button>
          </div>
        </div>
      )}

      {/* Context Menu Overlay */}
      {contextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm transition-opacity" 
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div 
            className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px] flex flex-col"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 200),
              left: Math.min(contextMenu.x, window.innerWidth - 180),
            }}
          >
            <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(contextMenu.msgId, emoji)}
                  className="hover:scale-125 transition-transform text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
            {(() => {
              const msg = optimisticMessages.find(m => m.id === contextMenu.msgId);
              if (!msg) return null;
              const isMine = msg.userId === currentUserId;
              const isPinned = pinnedMessage?.id === msg.id;

              // Find first location in text if any
              const locationMatch = /@\[([^\]]+)\]\(([^)]+)\)/.exec(msg.text);

              return (
                <>
                  {creatorId === currentUserId && locationMatch && msg.messageType !== 'deleted' && (
                    <button 
                      onClick={() => {
                        handleSetLocation(locationMatch[1], locationMatch[2]);
                        setContextMenu(null);
                      }} 
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 flex items-center gap-2 text-indigo-700 font-semibold border-b border-gray-100"
                    >
                      <MapPin className="w-4 h-4" /> Set as Plan Location
                    </button>
                  )}
                  <button onClick={() => { setReplyingTo(msg); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                    <CornerUpLeft className="w-4 h-4" /> Reply
                  </button>
                  <button onClick={() => { if (isPinned) handleUnpin(); else handlePin(msg.id); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                    <Pin className="w-4 h-4" /> {isPinned ? "Unpin" : "Pin"}
                  </button>
                  {isMine && (
                    <button onClick={() => handleDelete(msg.id)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* Pinned Message Bar */}
      {pinnedMessage && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 25,
          backgroundColor: '#EEF2FF',
          borderBottom: '1px solid #E0E7FF',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        }} onClick={() => {
          // Find the pinned message in DOM and scroll to it (rough approximation)
          // Since we might not have a ref to every message, we can just alert or scroll roughly
          alert("Scrolled to pinned message: " + pinnedMessage.text);
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
            <Pin className="w-4 h-4 text-[#4F46E5] flex-shrink-0" />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#4F46E5' }}>Pinned by {pinnedMessage.senderName}</span>
              <span style={{ fontSize: '13px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pinnedMessage.text.includes("poll:") ? "📊 Poll" : pinnedMessage.text}
              </span>
            </div>
          </div>
          {(currentUserId === creatorId || pinnedMessage.senderName === "You") && (
            <button onClick={(e) => { e.stopPropagation(); handleUnpin(); }} style={{ padding: '4px', color: '#6B7280' }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Chat Feed */}
      <main 
        ref={scrollRef}
        onScroll={() => {
          if (!scrollRef.current) return;
          const isScrolledUp = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight > 100;
          if (!isScrolledUp) setShowNewBadge(false);
        }}
        className="flex-1 min-h-0 px-4 py-6 flex flex-col gap-6 overflow-y-auto overflow-x-hidden hide-scrollbar bg-white"
      >
        <div className="flex flex-col items-center justify-center text-center py-6 px-4 border-b border-gray-100 mb-2 relative">
          <button 
            onClick={handleLeave} 
            className="absolute right-0 top-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" 
            title="Leave Plan"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-3 shadow-sm border border-indigo-100/50">
            <span className="text-2xl">👋</span>
          </div>
          <h3 className="text-[#111827] font-bold text-[16px] mb-1">Welcome to the chat!</h3>
          <p className="text-[13px] text-[#6B7280] max-w-[240px]">
            Introduce yourself and coordinate the details.
          </p>
        </div>

        {Object.entries(groupedMessages).map(([dateStr, messages]) => (
          <div key={dateStr} className="flex flex-col gap-0 min-w-0">
            <div className="flex justify-center -my-2 relative z-0">
              <span className="text-xs font-semibold text-[#6B7280] bg-[#F9FAFB] border border-gray-100 px-6 py-1 rounded-full uppercase tracking-wider shadow-sm z-10">
                {formatGroupDate(dateStr)}
              </span>
            </div>
            
            {messages.map((msg, index) => {
              const repliedMsg = msg.replyToId ? optimisticMessages.find(m => m.id === msg.replyToId) : null;
              const isMine = msg.userId === currentUserId;
              
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
              
              const isSameUserAsPrev = prevMsg && prevMsg.userId === msg.userId;
              const isSameUserAsNext = nextMsg && nextMsg.userId === msg.userId;
              
              const timeDiffPrev = prevMsg ? (msg.createdAt.getTime() - prevMsg.createdAt.getTime()) / 1000 : 600;
              const timeDiffNext = nextMsg ? (nextMsg.createdAt.getTime() - msg.createdAt.getTime()) / 1000 : 600;
              
              const clustersWithPrev = isSameUserAsPrev && timeDiffPrev < 120;
              const clustersWithNext = isSameUserAsNext && timeDiffNext < 120;

              const isFirstInCluster = !clustersWithPrev;
              const isLastInCluster = !clustersWithNext;

              const bubbleRadius = isMine
                ? `rounded-2xl ${!isFirstInCluster ? "rounded-tr-[4px]" : ""} ${!isLastInCluster ? "rounded-br-[4px]" : "rounded-br-none"}`
                : `rounded-2xl ${!isFirstInCluster ? "rounded-tl-[4px]" : ""} ${!isLastInCluster ? "rounded-bl-[4px]" : "rounded-bl-none"}`;

              return (
                <div 
                  key={msg.id} 
                  style={{
                    display: 'flex',
                    width: '100%',
                    minWidth: 0,
                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                    marginTop: isFirstInCluster ? '12px' : '2px',
                  }}
                  className="group"
                >
                  {/* Avatar spacer for non-mine messages */}
                  {!isMine && (
                    <div style={{ width: '32px', flexShrink: 0, marginRight: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      {isLastInCluster && (
                        msg.avatar ? (
                          <img src={msg.avatar} alt={msg.senderName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #F3F4F6', marginBottom: '2px' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0, border: '1px solid #E0E7FF', marginBottom: '2px' }}>
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: '80%',
                    minWidth: 0,
                    alignItems: isMine ? 'flex-end' : 'flex-start',
                  }}>
                    {!isMine && isFirstInCluster && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', marginLeft: '4px', marginBottom: '4px' }}>{msg.senderName}</span>
                    )}

                    <div style={{ position: 'relative' }} className="group/bubble">
                      
                      <div 
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ msgId: msg.id, x: e.clientX, y: e.clientY });
                        }}
                        style={{
                          display: 'inline-block',
                          padding: '8px 14px',
                          maxWidth: '100%',
                          backgroundColor: msg.messageType === 'deleted' ? 'transparent' : (isMine ? '#4F46E5' : '#F3F4F6'),
                          color: msg.messageType === 'deleted' ? '#9CA3AF' : (isMine ? '#FFFFFF' : '#111827'),
                          border: msg.messageType === 'deleted' ? '1px solid #E5E7EB' : 'none',
                          borderRadius: '16px',
                          ...(isMine ? {
                            ...(!isFirstInCluster ? { borderTopRightRadius: '4px' } : {}),
                            ...(!isLastInCluster ? { borderBottomRightRadius: '4px' } : { borderBottomRightRadius: '0px' }),
                          } : {
                            ...(!isFirstInCluster ? { borderTopLeftRadius: '4px' } : {}),
                            ...(!isLastInCluster ? { borderBottomLeftRadius: '4px' } : { borderBottomLeftRadius: '0px' }),
                          }),
                          boxShadow: msg.messageType === 'deleted' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          fontStyle: msg.messageType === 'deleted' ? 'italic' : 'normal',
                          cursor: 'pointer',
                        }}
                      >
                        {repliedMsg && msg.messageType !== 'deleted' && (
                          <div style={{
                            marginBottom: '6px',
                            paddingLeft: '10px',
                            borderLeft: `2px solid ${isMine ? 'rgba(255,255,255,0.5)' : '#9CA3AF'}`,
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '0 6px 6px 0',
                            backgroundColor: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(229,231,235,0.5)',
                            color: isMine ? 'rgba(255,255,255,0.9)' : '#4B5563',
                          }}>
                            <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', opacity: 0.9 }}>{repliedMsg.senderName}</span>
                            <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', opacity: 0.8 }}>{repliedMsg.text}</span>
                          </div>
                        )}

                        {msg.messageType === 'poll' && pollsMap?.[parseInt(msg.text.split(':')[1])] ? (() => {
                          const poll = pollsMap[parseInt(msg.text.split(':')[1])];
                          const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
                          return (
                            <div style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                                <BarChart3 className="w-4 h-4" /> Poll
                              </div>
                              <p style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{poll.question}</p>
                              {poll.options.map(opt => {
                                const isVoted = opt.votes.some(v => v.userId === currentUserId);
                                const percent = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => handleVotePoll(opt.id)}
                                    style={{
                                      position: 'relative',
                                      width: '100%',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      backgroundColor: isMine ? 'rgba(255,255,255,0.15)' : '#FFFFFF',
                                      border: isMine ? '1px solid rgba(255,255,255,0.3)' : '1px solid #E5E7EB',
                                      textAlign: 'left',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <div style={{
                                      position: 'absolute',
                                      left: 0, top: 0, bottom: 0,
                                      width: `${percent}%`,
                                      backgroundColor: isMine ? 'rgba(255,255,255,0.2)' : '#EEF2FF',
                                      zIndex: 0,
                                      transition: 'width 0.3s ease',
                                    }} />
                                    <span style={{ position: 'relative', zIndex: 1, fontSize: '14px', fontWeight: isVoted ? 600 : 400 }}>
                                      {opt.text}
                                    </span>
                                    <span style={{ position: 'relative', zIndex: 1, fontSize: '12px', opacity: 0.8, fontWeight: 600 }}>
                                      {opt.votes.length > 0 ? opt.votes.length : ''}
                                    </span>
                                  </button>
                                );
                              })}
                              <span style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                            </div>
                          );
                        })() : (
                          <span style={{
                            fontSize: '15px',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                          }}>
                            {msg.messageType === 'deleted' ? msg.text : renderMessageText(msg.text, isMine)}
                          </span>
                        )}
                      </div>

                      {/* Reactions Component */}
                      {msg.reactions && msg.reactions.length > 0 && msg.messageType !== 'deleted' && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          marginTop: '4px',
                          justifyContent: isMine ? 'flex-end' : 'flex-start',
                        }}>
                          {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => {
                            const count = msg.reactions!.filter(r => r.emoji === emoji).length;
                            const hasReacted = msg.reactions!.some(r => r.emoji === emoji && r.userId === currentUserId);
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 6px',
                                  borderRadius: '12px',
                                  backgroundColor: hasReacted ? '#EEF2FF' : '#F9FAFB',
                                  border: hasReacted ? '1px solid #C7D2FE' : '1px solid #F3F4F6',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                <span>{emoji}</span>
                                <span style={{ color: hasReacted ? '#4F46E5' : '#6B7280', fontWeight: 600 }}>{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Context Menu Button - Hover Action */}
                      {msg.messageType !== 'deleted' && (
                        <button 
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setContextMenu({ 
                              msgId: msg.id, 
                              x: isMine ? rect.right - 180 : rect.left, 
                              y: rect.bottom 
                            });
                          }}
                          className="md:opacity-0 opacity-100 group-hover/bubble:opacity-100 transition-opacity"
                          style={{
                            position: 'absolute',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            ...(isMine ? { left: '-36px' } : { right: '-36px' }),
                            padding: '6px',
                            color: '#9CA3AF',
                            borderRadius: '50%',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                          title="More actions"
                        >
                          <MoreVertical className="w-5 h-5 hover:text-gray-600 transition-colors" />
                        </button>
                      )}

                    </div>

                    {isLastInCluster && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        color: '#9CA3AF',
                        marginTop: '4px',
                        ...(isMine ? { marginRight: '4px' } : { marginLeft: '4px' }),
                      }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
        ))}
        
        {/* Read Receipts */}
        {readReceipts && readReceipts.length > 0 && optimisticMessages.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '8px', marginTop: '-12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {readReceipts.filter(r => {
                const lastMsg = optimisticMessages[optimisticMessages.length - 1];
                return r.lastReadAt >= lastMsg.createdAt;
              }).map((receipt, i) => (
                <div key={receipt.userId} style={{ 
                  width: '16px', height: '16px', borderRadius: '50%', 
                  backgroundColor: '#E5E7EB', border: '2px solid white',
                  marginLeft: i > 0 ? '-6px' : '0', overflow: 'hidden', zIndex: 10 - i,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} title={`Read by ${receipt.name}`}>
                  {receipt.avatar ? (
                    <img src={receipt.avatar} alt={receipt.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '8px', color: '#6B7280', fontWeight: 700 }}>{receipt.name.charAt(0)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Sticky Footer / Input Area */}
      <div className="bg-white/90 backdrop-blur-xl p-4 pb-safe z-30 border-t border-gray-100 flex-shrink-0 relative">
        {!isJoined ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-center text-[#6B7280] uppercase tracking-wider">
              You are viewing in read-only mode
            </p>
            <button 
              onClick={handleJoin}
              disabled={isPending}
              className="w-full h-14 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-lg font-bold rounded-xl flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-[#4F46E5]/20 disabled:opacity-70"
            >
              Join this plan
            </button>
          </div>
        ) : (
          <div className="flex flex-col relative">
            {showNewBadge && (
              <div className="absolute -top-14 left-0 right-0 flex justify-center z-50 animate-bounce">
                <button
                  onClick={() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                    setShowNewBadge(false);
                  }}
                  className="bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13px] font-bold px-4 py-2 rounded-full shadow-lg shadow-[#4F46E5]/20 flex items-center gap-1.5 transition-transform"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  New Message
                </button>
              </div>
            )}

            {typingUsers.length > 0 && (
              <div className="absolute -top-6 left-2 text-[11px] text-[#6B7280] font-semibold animate-pulse pb-1 flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1 h-1 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1 h-1 bg-[#6B7280] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
                {typingUsers.length === 1 ? `${typingUsers[0]} is typing...` : `${typingUsers.length} people are typing...`}
              </div>
            )}

            {/* Poll Creator (Moved to Modal Overlay) */}

            {/* Mention Dropdown */}
            {mentionQuery !== null && mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-full bg-white border border-gray-100 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                <div className="max-h-60 overflow-y-auto hide-scrollbar">
                  {mentionSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleMentionSelect(suggestion)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-[#4F46E5]" />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold text-[#111827] truncate">{suggestion.mainText}</span>
                        {suggestion.secondaryText && (
                          <span className="text-xs text-gray-500 truncate">{suggestion.secondaryText}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {replyingTo && (
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-t-2xl border-x border-t border-gray-100 -mb-2 pb-3 mx-1">
                <div className="flex flex-col text-xs pr-4">
                  <span className="font-semibold text-[#4F46E5] mb-0.5">Replying to {replyingTo.senderName}</span>
                  <span className="text-gray-500 line-clamp-1">{replyingTo.text}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setReplyingTo(null)}
                  className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <form onSubmit={handleSend} className="flex items-end gap-3 relative z-10">
              <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    placeholder="Type a message..."
                    value={message}
                    onChange={handleType}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                    rows={1}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      maxHeight: '140px',
                      paddingLeft: '20px',
                      paddingRight: '16px',
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      backgroundColor: '#F3F4F6',
                      borderRadius: '16px',
                      fontSize: '15px',
                      lineHeight: '1.5',
                      resize: 'none',
                      border: 'none',
                      outline: 'none',
                      overflow: 'auto',
                      fontFamily: 'inherit',
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 140) + 'px';
                    }}
                    autoFocus
                  />
              </div>
              <button 
                type="submit"
                disabled={!message.trim() || isPending}
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: message.trim() ? '#111827' : '#F3F4F6',
                  color: message.trim() ? '#FFFFFF' : '#9CA3AF',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: message.trim() ? 'pointer' : 'default',
                  flexShrink: 0,
                  transition: 'background-color 200ms, color 200ms',
                }}
              >
                <Send className="w-5 h-5" style={{ marginLeft: '2px' }} />
              </button>
              <button 
                type="button"
                onClick={() => setShowPollCreator(!showPollCreator)}
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: showPollCreator ? '#EEF2FF' : '#F3F4F6',
                  color: showPollCreator ? '#4F46E5' : '#9CA3AF',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 200ms, color 200ms',
                }}
                title="Create Poll"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
