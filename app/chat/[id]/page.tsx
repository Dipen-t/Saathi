import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Users } from "lucide-react";
import { db } from "@/db";
import { conversations, messages, participants, categories } from "@/db/schema";
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

  // Fetch Participants count
  const allParticipants = await db.select().from(participants).where(eq(participants.conversationId, conversationId));
  const participantCount = allParticipants.length;
  
  // Check if current user has joined
  const hasJoined = allParticipants.some(p => p.userId === user.id);

  // Fetch Messages with basic sender info (for a real app, join with users table)
  const dbMessages = await db.select().from(messages).where(eq(messages.conversationId, conversationId));
  
  // Map messages for the client
  const mappedMessages = dbMessages.map(m => ({
    id: m.id,
    userId: m.userId,
    text: m.text,
    createdAt: m.createdAt,
    senderName: m.userId === user.id ? "You" : "Member",
  }));

  return (
    <div className="min-h-screen bg-white flex justify-center font-sans">
      
      {/* Mobile Wrapper */}
      <div className="w-full max-w-md bg-white min-h-screen relative flex flex-col md:border-x md:border-gray-200 shadow-sm">
        
        {/* Header (Context) */}
        <header className="px-6 pt-6 pb-4 sticky top-0 bg-white/90 backdrop-blur-xl z-20 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <Link href={`/category/${conversation.categoryId}`} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm text-[#111827] hover:bg-gray-50 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex flex-col pt-1">
              <h1 className="text-xl font-bold tracking-tight text-[#111827] leading-tight">
                {category?.emoji} {conversation.title}
              </h1>
              <div className="flex items-center gap-1.5 mt-1 text-[#6B7280]">
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">{participantCount} Participants</span>
              </div>
            </div>
          </div>

          {/* Meta Row (Only show if Location or Time exists) */}
          {(conversation.location || conversation.time) && (
            <div className="flex items-center gap-4 text-xs font-medium text-[#6B7280] bg-[#FAFAFA] p-3 rounded-xl border border-gray-100">
              {conversation.time && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{conversation.time}</span>
                </div>
              )}
              {conversation.location && conversation.time && (
                <div className="w-1 h-1 rounded-full bg-gray-300"></div>
              )}
              {conversation.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[120px]">{conversation.location}</span>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Interactive Chat Client */}
        <ChatClient 
          conversationId={conversationId} 
          initialMessages={mappedMessages} 
          hasJoined={hasJoined} 
          currentUserId={user.id} 
        />

      </div>
    </div>
  );
}
