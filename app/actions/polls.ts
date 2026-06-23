"use server";

import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { polls, pollOptions, pollVotes, messages } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";

export async function createPoll(conversationId: number, question: string, options: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Must be logged in" };

    if (options.length < 2) return { error: "Need at least 2 options" };
    if (options.length > 6) return { error: "Maximum 6 options allowed" };

    // Create the poll
    const [poll] = await db.insert(polls).values({
      conversationId,
      creatorId: user.id,
      question,
    }).returning({ id: polls.id });

    // Create options
    for (const optText of options) {
      await db.insert(pollOptions).values({
        pollId: poll.id,
        text: optText,
      });
    }

    // Create a system message linking to the poll
    await db.insert(messages).values({
      conversationId,
      userId: user.id,
      text: `poll:${poll.id}`,
      messageType: "poll",
    });

    revalidatePath(`/chat/${conversationId}`);
    return { success: true, pollId: poll.id };
  } catch (err: any) {
    console.error("CREATE_POLL_ERROR", err);
    return { error: err.message };
  }
}

export async function votePoll(pollOptionId: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Must be logged in" };

    // Check if already voted for this option
    const existing = await db.select().from(pollVotes).where(
      and(
        eq(pollVotes.pollOptionId, pollOptionId),
        eq(pollVotes.userId, user.id)
      )
    );

    if (existing.length > 0) {
      // Un-vote
      await db.delete(pollVotes).where(eq(pollVotes.id, existing[0].id));
      return { success: true, action: "removed" };
    } else {
      // Vote
      await db.insert(pollVotes).values({
        pollOptionId,
        userId: user.id,
      });
      return { success: true, action: "added" };
    }
  } catch (err: any) {
    console.error("VOTE_POLL_ERROR", err);
    return { error: err.message };
  }
}
