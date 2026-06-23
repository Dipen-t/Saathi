"use server";

import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { messages, participants, reactions, conversations } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

export async function joinConversation(conversationId: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Must be logged in to join a plan." };
    }

    await db.insert(participants).values({
      conversationId,
      userId: user.id,
    }).onConflictDoNothing();

    revalidatePath(`/chat/${conversationId}`);
    return { success: true };
  } catch (err: any) {
    console.error("JOIN_ERROR", err);
    return { error: err.message || "Failed to join conversation." };
  }
}

export async function sendMessage(conversationId: number, text: string, replyToId?: number, messageType: string = "text") {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Must be logged in to send a message." };
    }

    const [inserted] = await db.insert(messages).values({
      conversationId,
      userId: user.id,
      text,
      messageType,
      replyToId: replyToId || null,
    }).returning({ id: messages.id });

    revalidatePath(`/chat/${conversationId}`);
    return { success: true, messageId: inserted.id };
  } catch (err: any) {
    console.error("SEND_MESSAGE_ERROR", err);
    return { error: err.message || "Failed to send message." };
  }
}

export async function updateLastRead(conversationId: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "Must be logged in" };

    await db.update(participants)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(participants.conversationId, conversationId),
          eq(participants.userId, user.id)
        )
      );
    
    revalidatePath("/feed");
    return { success: true };
  } catch (err: any) {
    console.error("UPDATE_LAST_READ_ERROR", err);
    return { error: err.message };
  }
}

export async function toggleReaction(messageId: number, emoji: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Must be logged in" };

    // Check if reaction exists
    const existing = await db.select().from(reactions).where(
      and(
        eq(reactions.messageId, messageId),
        eq(reactions.userId, user.id),
        eq(reactions.emoji, emoji)
      )
    );

    if (existing.length > 0) {
      // Remove reaction
      await db.delete(reactions).where(eq(reactions.id, existing[0].id));
      return { success: true, action: "removed" };
    } else {
      // Add reaction
      await db.insert(reactions).values({
        messageId,
        userId: user.id,
        emoji,
      });
      return { success: true, action: "added" };
    }
  } catch (err: any) {
    console.error("TOGGLE_REACTION_ERROR", err);
    return { error: err.message };
  }
}

export async function deleteMessage(messageId: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Must be logged in" };

    // Only allow deleting own messages
    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
    if (!msg) return { error: "Message not found" };
    if (msg.userId !== user.id) return { error: "Can only delete your own messages" };

    await db.update(messages)
      .set({ text: "This message was deleted", messageType: "deleted" })
      .where(eq(messages.id, messageId));

    // Also delete reactions on this message
    await db.delete(reactions).where(eq(reactions.messageId, messageId));

    revalidatePath(`/chat/${msg.conversationId}`);
    return { success: true };
  } catch (err: any) {
    console.error("DELETE_MESSAGE_ERROR", err);
    return { error: err.message };
  }
}

export async function pinMessage(conversationId: number, messageId: number | null) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Must be logged in" };

    await db.update(conversations)
      .set({ pinnedMessageId: messageId })
      .where(eq(conversations.id, conversationId));

    revalidatePath(`/chat/${conversationId}`);
    return { success: true };
  } catch (err: any) {
    console.error("PIN_MESSAGE_ERROR", err);
    return { error: err.message };
  }
}

export async function leaveConversation(conversationId: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Must be logged in" };

    await db.delete(participants).where(
      and(
        eq(participants.conversationId, conversationId),
        eq(participants.userId, user.id)
      )
    );

    revalidatePath(`/chat/${conversationId}`);
    revalidatePath("/feed");
    return { success: true };
  } catch (err: any) {
    console.error("LEAVE_CONVERSATION_ERROR", err);
    return { error: err.message };
  }
}

export async function setConversationLocation(conversationId: number, location: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Must be logged in" };

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!conv) return { error: "Conversation not found" };
    if (conv.creatorId !== user.id) return { error: "Only the creator can set the location" };

    await db.update(conversations)
      .set({ location })
      .where(eq(conversations.id, conversationId));

    revalidatePath(`/chat/${conversationId}`);
    revalidatePath(`/category/${conv.categoryId}`);
    return { success: true };
  } catch (err: any) {
    console.error("SET_LOCATION_ERROR", err);
    return { error: err.message };
  }
}
