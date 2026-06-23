import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Users, Sparkles } from "lucide-react";
import { db } from "@/db";
import { conversations, messages, participants, categories, users, reactions, polls, pollOptions, pollVotes } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
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
      avatar: users.avatar,
      lastReadAt: participants.lastReadAt,
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
  
  // Fetch all reactions for messages in this conversation
  const messageIds = dbMessages.map(m => m.id);
  const allReactions = messageIds.length > 0 
    ? await db.select().from(reactions).where(inArray(reactions.messageId, messageIds))
    : [];

  // Group reactions by message_id
  const reactionsMap: Record<number, { emoji: string; userId: string; }[]> = {};
  allReactions.forEach(r => {
    if (!reactionsMap[r.messageId]) reactionsMap[r.messageId] = [];
    reactionsMap[r.messageId].push({ emoji: r.emoji, userId: r.userId });
  });

  // Fetch polls data for poll-type messages
  const pollMessages = dbMessages.filter(m => m.messageType === "poll");
  const pollIds = pollMessages.map(m => {
    const match = m.text.match(/^poll:(\d+)$/);
    return match ? parseInt(match[1]) : null;
  }).filter(Boolean) as number[];

  let pollsMap: Record<number, { question: string; creatorId: string; options: { id: number; text: string; votes: { userId: string }[] }[] }> = {};
  
  if (pollIds.length > 0) {
    const dbPolls = await db.select().from(polls).where(inArray(polls.id, pollIds));
    const dbPollOptions = await db.select().from(pollOptions).where(inArray(pollOptions.pollId, pollIds));
    const optionIds = dbPollOptions.map(o => o.id);
    const dbPollVotes = optionIds.length > 0
      ? await db.select().from(pollVotes).where(inArray(pollVotes.pollOptionId, optionIds))
      : [];

    for (const poll of dbPolls) {
      const opts = dbPollOptions.filter(o => o.pollId === poll.id).map(o => ({
        id: o.id,
        text: o.text,
        votes: dbPollVotes.filter(v => v.pollOptionId === o.id).map(v => ({ userId: v.userId })),
      }));
      pollsMap[poll.id] = { question: poll.question, creatorId: poll.creatorId, options: opts };
    }
  }

  // Fetch pinned message
  let pinnedMessage: { id: number; text: string; senderName: string } | null = null;
  if (conversation.pinnedMessageId) {
    const [pm] = await db.select().from(messages).where(eq(messages.id, conversation.pinnedMessageId));
    if (pm) {
      pinnedMessage = {
        id: pm.id,
        text: pm.text,
        senderName: pm.userId === user.id ? "You" : (participantMap[pm.userId]?.name || "Member"),
      };
    }
  }

  // Read receipts: participant lastReadAt
  const readReceipts = allParticipantsWithUsers
    .filter(p => p.userId !== user.id)
    .map(p => ({
      userId: p.userId,
      name: p.name || "Member",
      avatar: p.avatar,
      lastReadAt: p.lastReadAt,
    }));

  // Map messages for the client
  const mappedMessages = dbMessages.map(m => ({
    id: m.id,
    userId: m.userId,
    text: m.text,
    messageType: m.messageType,
    replyToId: m.replyToId,
    createdAt: m.createdAt,
    senderName: m.userId === user.id ? "You" : (participantMap[m.userId]?.name || "Member"),
    avatar: m.userId === user.id ? (userProfile?.avatar || null) : (participantMap[m.userId]?.avatar || null),
    reactions: reactionsMap[m.id] || [],
  }));

  return (
    <div className="fixed inset-0 bg-gray-50 flex justify-center font-sans overflow-hidden">
      
      {/* Mobile Wrapper */}
      <div className="w-full max-w-md bg-white h-full relative flex flex-col md:border-x md:border-gray-200 shadow-xl overflow-hidden">
        
        {/* Header */}
        <header style={{
          padding: '12px 16px',
          position: 'sticky',
          top: 0,
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 20,
          borderBottom: '1px solid #F3F4F6',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href={`/category/${conversation.categoryId}`} style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#111827',
              flexShrink: 0,
              textDecoration: 'none',
            }}>
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#111827',
                lineHeight: 1.3,
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {category?.emoji} {conversation.title}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Users style={{ width: '12px', height: '12px' }} />
                  {participantCount}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9CA3AF' }}>
                  <Clock style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conversation.time || "TBD"}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9CA3AF' }}>
                  <MapPin style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>{conversation.location || "TBD"}</span>
                </span>
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
          pinnedMessage={pinnedMessage}
          pollsMap={pollsMap}
          readReceipts={readReceipts}
          creatorId={conversation.creatorId}
        />

      </div>
    </div>
  );
}
