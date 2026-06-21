import Link from "next/link";
import { ArrowLeft, ArrowRight, MapPin, Clock, Users, Search, SlidersHorizontal, Plus } from "lucide-react";
import { db } from "@/db";
import { conversations } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const categoryId = resolvedParams.id;
  
  // Format the ID nicely for the header
  const categoryName = categoryId.charAt(0).toUpperCase() + categoryId.slice(1);

  // Fetch real conversations from Postgres
  const dbConversations = await db.select().from(conversations).where(eq(conversations.categoryId, categoryId));


  return (
    <div className="min-h-screen bg-[#FAFAFA] flex justify-center font-sans pb-6">
      
      {/* Mobile Wrapper */}
      <div className="w-full max-w-md bg-[#FAFAFA] min-h-screen relative flex flex-col md:border-x md:border-gray-200">
        
        {/* Header */}
        <header className="px-6 pt-6 pb-4 flex items-center gap-4 sticky top-0 bg-[#FAFAFA]/90 backdrop-blur-xl z-20">
          <Link href="/feed" className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm text-[#111827] hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              {categoryName}
            </h1>
            <p className="text-sm font-medium text-[#6B7280]">
              {dbConversations.length} active conversations
            </p>
          </div>
        </header>

        {/* Search & Filter Bar */}
        <div className="px-6 pb-6 pt-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search conversations..." 
                className="w-full h-12 pl-11 pr-4 bg-white rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all"
              />
            </div>
            <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#111827] hover:bg-gray-50 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conversations Feed */}
        <main className="flex-1 px-6 flex flex-col gap-4 pb-8">
          {dbConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center px-4">
              <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-[#111827]">No plans yet</h3>
              <p className="text-sm text-[#6B7280] mt-1 max-w-[200px] leading-relaxed">Be the first to start a conversation in {categoryName}!</p>
            </div>
          ) : (
            dbConversations.map((activity) => (
              <Link 
                key={activity.id} 
                href={`/chat/${activity.id}`}
                className="bg-white rounded-[20px] p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col gap-3 transition-transform active:scale-[0.98] cursor-pointer group hover:shadow-[0px_8px_30px_rgba(0,0,0,0.06)]"
              >
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold text-[#111827] tracking-tight leading-tight">
                    {activity.title}
                  </h2>
                  <p className="text-[#6B7280] text-sm leading-relaxed">
                    {activity.description}
                  </p>
                </div>

                {/* Details List */}
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">{activity.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">{activity.location}</span>
                  </div>
                </div>

                {/* Footer / Action */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-semibold">0 joined</span>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-[#111827] group-hover:bg-[#111827] group-hover:text-white transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </main>

        {/* Create FAB (Fixed via inline styles to guarantee position) */}
        <Link 
          href={`/create?category=${categoryId}`}
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50 }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#111827] text-white shadow-[0_8px_30px_rgba(17,24,39,0.3)] transition-transform hover:bg-black active:scale-95"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </Link>

      </div>
    </div>
  );
}
