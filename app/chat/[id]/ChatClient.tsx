"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Send, CornerUpLeft, X } from "lucide-react";
import { joinConversation, sendMessage } from "@/app/actions/chat";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Message = {
  id: number;
  userId: string;
  text: string;
  createdAt: Date;
  senderName: string;
  avatar?: string | null;
  replyToId?: number | null;
};

export default function ChatClient({ 
  conversationId, 
  initialMessages, 
  hasJoined,
  currentUserId,
  currentUserAvatar,
  participantMap
}: { 
  conversationId: number, 
  initialMessages: Message[], 
  hasJoined: boolean,
  currentUserId: string,
  currentUserAvatar: string | null,
  participantMap: Record<string, { name: string, avatar: string | null }>
}) {
  const [isJoined, setIsJoined] = useState(hasJoined);
  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`realtime:conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // If message is from someone else, add it optimistically
          if (payload.new.user_id !== currentUserId) {
            const incomingMsg: Message = {
              id: payload.new.id,
              userId: payload.new.user_id,
              text: payload.new.text,
              createdAt: new Date(payload.new.created_at),
              senderName: participantMap[payload.new.user_id]?.name || "Member",
              avatar: participantMap[payload.new.user_id]?.avatar || null,
              replyToId: payload.new.reply_to_id || null,
            };
            setOptimisticMessages(prev => {
              // Deduplicate just in case
              if (prev.find(m => m.id === incomingMsg.id)) return prev;
              return [...prev, incomingMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, participantMap, supabase]);

  // Sync state if props change (revalidation)
  useEffect(() => {
    setOptimisticMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setIsJoined(hasJoined);
  }, [hasJoined]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const textToSend = message.trim();
    setMessage(""); // clear input instantly
    
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

  return (
    <>
      {/* Chat Feed */}
      <main className="flex-1 px-6 py-6 flex flex-col gap-6 overflow-y-auto pb-32 hide-scrollbar bg-white">
        <div className="flex flex-col items-center justify-center text-center pb-8 border-b border-gray-100 mb-2">
          <div className="w-16 h-16 bg-[#FAFAFA] border border-gray-100 rounded-full flex items-center justify-center text-3xl mb-4">
            👋
          </div>
          <h2 className="text-lg font-bold text-[#111827]">Welcome to the chat!</h2>
          <p className="text-sm text-[#6B7280] mt-1 max-w-[250px]">
            Introduce yourself and coordinate the plan with the others.
          </p>
        </div>

        {optimisticMessages.map((msg) => {
          const repliedMsg = msg.replyToId ? optimisticMessages.find(m => m.id === msg.replyToId) : null;
          return (
            <div key={msg.id} className="flex gap-4 group">
              {msg.avatar ? (
                <img src={msg.avatar} alt={msg.senderName} className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-200 bg-gray-50" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#111827] shrink-0 border border-gray-200">
                  {msg.senderName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col flex-1 pt-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[#111827] text-sm">{msg.senderName}</span>
                  <span className="text-xs font-medium text-gray-400">{formatTime(msg.createdAt)}</span>
                </div>
                {repliedMsg && (
                  <div className="mb-1.5 pl-3 border-l-2 border-[#4F46E5] bg-gray-50 rounded-r-md py-1.5 px-3 text-xs text-[#6B7280]">
                    <span className="font-semibold text-[#111827] block mb-0.5">{repliedMsg.senderName}</span>
                    <span className="line-clamp-1">{repliedMsg.text}</span>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <p className="text-[#111827] text-[15px] leading-relaxed">
                    {msg.text}
                  </p>
                  <button 
                    onClick={() => setReplyingTo(msg)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-[#4F46E5] hover:bg-indigo-50 rounded-lg -mb-1"
                    title="Reply"
                  >
                    <CornerUpLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Sticky Footer / Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl p-4 pb-safe z-30">
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
          <div className="flex flex-col">
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
            <form onSubmit={handleSend} className="flex items-center gap-3 relative z-10">
              <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full h-14 pl-5 pr-12 bg-gray-100 rounded-2xl text-[15px] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4F46E5]/20 shadow-inner transition-all"
                    autoFocus
                  />
              </div>
              <button 
                type="submit"
                disabled={!message.trim() || isPending}
                className="w-14 h-14 bg-[#111827] hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-2xl flex items-center justify-center transition-transform active:scale-95 shrink-0 shadow-sm"
              >
                <Send className="w-5 h-5 ml-1" />
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
