import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Users, Sparkles } from "lucide-react";
import { db } from "@/db";
import { conversations, messages, participants, categories, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import ChatClient from "./ChatClient";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const conversationId = parseInt(resolvedParams.id, 10);
  
  if (isNaN(conversationId)) notFound();

  // Get current user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // Fetch Conversation
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!conversation) notFound();

  // Fetch Category
  const [category] = await db.select().from(categories).where(eq(categories.id, conversation.categoryId));

  // Fetch Participants count and names
  const allParticipantsWithUsers = await db
    .select({
      userId: participants.userId,
      name: users.name,
      avatar: users.avatar
    })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.conversationId, conversationId));

  const participantCount = allParticipantsWithUsers.length;
  
  // Check if current user has joined
  const hasJoined = allParticipantsWithUsers.some(p => p.userId === user.id);

  const participantMap = allParticipantsWithUsers.reduce((acc, p) => {
    acc[p.userId] = { name: p.name || "Member", avatar: p.avatar };
    return acc;
  }, {} as Record<string, { name: string, avatar: string | null }>);

  // Fetch current user profile just in case they aren't a participant yet
  const [userProfile] = await db.select().from(users).where(eq(users.id, user.id));

  // Fetch Messages with basic sender info
  const dbMessages = await db.select().from(messages).where(eq(messages.conversationId, conversationId));
  
  // Map messages for the client
  const mappedMessages = dbMessages.map(m => ({
    id: m.id,
    userId: m.userId,
    text: m.text,
    replyToId: m.replyToId,
    createdAt: m.createdAt,
    senderName: m.userId === user.id ? "You" : (participantMap[m.userId]?.name || "Member"),
    avatar: m.userId === user.id ? (userProfile?.avatar || null) : (participantMap[m.userId]?.avatar || null),
  }));

  return (
    <div className="min-h-screen bg-white flex justify-center font-sans">
      
      {/* Mobile Wrapper */}
      <div className="w-full max-w-md bg-white min-h-screen relative flex flex-col md:border-x md:border-gray-200 shadow-sm">
        
        {/* Header (Context) */}
        <header className="px-6 pt-6 pb-4 sticky top-0 bg-white/90 backdrop-blur-xl z-20 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Link href={`/category/${conversation.categoryId}`} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm text-[#111827] hover:bg-gray-50 transition-colors shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex flex-col pt-1">
                <h1 className="text-xl font-bold tracking-tight text-[#111827] leading-tight pr-2">
                  {category?.emoji} {conversation.title}
                </h1>
                <div className="flex items-center gap-1.5 mt-1 text-[#6B7280]">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">{participantCount} Participants</span>
                </div>
              </div>
            </div>
            
            {/* Top Right Meta */}
            <div className="flex flex-col items-end gap-1.5 pt-1 text-xs font-medium text-[#6B7280] shrink-0">
              <div className="flex items-center gap-1.5 bg-[#FAFAFA] px-3 py-1 rounded-lg border border-gray-100 shadow-sm max-w-[160px]">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{conversation.time || "To be decided"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#FAFAFA] px-3 py-1 rounded-lg border border-gray-100 shadow-sm max-w-[160px]">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{conversation.location || "To be decided"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Interactive Chat Client */}
        <ChatClient 
          conversationId={conversationId} 
          initialMessages={mappedMessages} 
          hasJoined={hasJoined} 
          currentUserId={user.id} 
          currentUserAvatar={userProfile?.avatar || null}
          participantMap={participantMap}
        />

      </div>
    </div>
  );
}
