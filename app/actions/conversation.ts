"use server";

import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { conversations, participants } from "@/db/schema";
import { redirect } from "next/navigation";

export async function createConversation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const categoryId = formData.get("categoryId") as string;
  const location = formData.get("location") as string;

  if (!title || !categoryId) {
    throw new Error("Title and Category are required.");
  }

  // 1. Insert Conversation
  const [newConversation] = await db.insert(conversations).values({
    title,
    description: description || null,
    location: location || null,
    categoryId,
    creatorId: user.id,
  }).returning({ id: conversations.id });

  // 2. Auto-Join the creator
  await db.insert(participants).values({
    conversationId: newConversation.id,
    userId: user.id,
  });

  // 3. Redirect to the new chat room
  redirect(`/chat/${newConversation.id}`);
}
