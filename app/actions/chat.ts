"use server";

import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { messages, participants } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function joinConversation(conversationId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to join a plan.");
  }

  await db.insert(participants).values({
    conversationId,
    userId: user.id,
  }).onConflictDoNothing();

  revalidatePath(`/chat/${conversationId}`);
}

export async function sendMessage(conversationId: number, text: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to send a message.");
  }

  await db.insert(messages).values({
    conversationId,
    userId: user.id,
    text,
  });

  revalidatePath(`/chat/${conversationId}`);
}
