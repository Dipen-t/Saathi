"use server";

import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function syncUserAfterLogin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Not authenticated");
  }

  // Check if user exists in Drizzle DB
  const existingUser = await db.select().from(users).where(eq(users.id, user.id));

  if (existingUser.length === 0) {
    // Insert new user into our Postgres database
    await db.insert(users).values({
      id: user.id,
      email: user.email || "",
      phone: user.phone || null,
    });
    
    // Brand new user -> send to onboarding
    redirect("/onboarding");
  } else {
    // Existing user -> send to feed
    redirect("/feed");
  }
}
