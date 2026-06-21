import { createClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { users, conversations, participants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import ProfileImageUpload from "./ProfileImageUpload";
import { signOut } from "@/app/actions/auth";
import Link from "next/link";
import { Home, Search, Building2, User, LogOut, Activity, Users } from "lucide-react";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/");
  }

  // Fetch from public.users
  const [userProfile] = await db.select().from(users).where(eq(users.id, authUser.id));

  if (!userProfile) {
    // Edge case if user is authenticated but not in our public schema yet
    // They should ideally re-trigger sync, but we'll show a fallback for now
    redirect("/");
  }

  // Fetch stats
  const userConversations = await db.select().from(conversations).where(eq(conversations.creatorId, authUser.id));
  const userParticipants = await db.select().from(participants).where(eq(participants.userId, authUser.id));

  const createdCount = userConversations.length;
  const joinedCount = userParticipants.length;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex justify-center font-sans pb-24 md:pb-0">
      <div className="w-full max-w-md bg-white min-h-screen relative flex flex-col md:border-x md:border-gray-200">
        
        {/* Profile Header (Gradient Background) */}
        <div className="h-48 bg-gradient-to-br from-[#4F46E5] via-[#7C3AED] to-[#EC4899] relative">
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
        </div>

        {/* Profile Info Area */}
        <main className="flex-1 px-6 relative flex flex-col items-center">
          
          {/* Avatar Upload Component (Overlapping the header) */}
          <div className="-mt-16 mb-4">
            <ProfileImageUpload currentAvatar={userProfile.avatar} userId={userProfile.id} />
          </div>

          <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight text-center">
            {userProfile.name || "Anonymous User"}
          </h1>
          <p className="text-[#6B7280] font-medium text-sm mt-1">
            {userProfile.email || "No email"}
          </p>

          {/* Stats Cards */}
          <div className="w-full grid grid-cols-2 gap-4 mt-8">
            <div className="bg-[#FAFAFA] rounded-3xl p-5 border border-gray-100 flex flex-col items-center text-center shadow-sm">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-3">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-[#111827]">{createdCount}</span>
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mt-1">Created</span>
            </div>
            
            <div className="bg-[#FAFAFA] rounded-3xl p-5 border border-gray-100 flex flex-col items-center text-center shadow-sm">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center mb-3">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-[#111827]">{joinedCount}</span>
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mt-1">Joined</span>
            </div>
          </div>

          {/* Actions */}
          <div className="w-full mt-10 flex flex-col gap-3">
            <form action={signOut}>
              <button 
                type="submit" 
                className="w-full h-14 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors border border-red-100"
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </button>
            </form>
          </div>

        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-0 bg-white border-t border-gray-100 pb-safe z-50">
          <div className="max-w-md mx-auto flex items-center justify-around h-20 px-4">
            <Link href="/feed" className="p-3 text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] rounded-2xl transition-colors">
              <Home className="w-6 h-6 stroke-[2.5]" />
            </Link>
            <button className="p-3 text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] rounded-2xl transition-colors">
              <Search className="w-6 h-6 stroke-[2.5]" />
            </button>
            <button className="p-3 text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] rounded-2xl transition-colors">
              <Building2 className="w-6 h-6 stroke-[2.5]" />
            </button>
            <Link href="/profile" className="p-3 text-[#111827] hover:bg-gray-50 rounded-2xl transition-colors">
              <User className="w-6 h-6 stroke-[2.5]" />
            </Link>
          </div>
        </nav>

      </div>
    </div>
  );
}
