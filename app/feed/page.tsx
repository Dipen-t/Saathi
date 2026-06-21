import Link from "next/link";
import { Search, Home, Plus, Building2, User } from "lucide-react";
import { db } from "@/db";
import { categories, conversations } from "@/db/schema";

export default async function FeedDirectory() {
  // Fetch real categories from the database
  const dbCategories = await db.select().from(categories);

  // Fetch all conversations to get counts per category
  const allConversations = await db.select().from(conversations);
  const counts = allConversations.reduce((acc, conv) => {
    acc[conv.categoryId] = (acc[conv.categoryId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex justify-center font-sans pb-24 md:pb-0">
      
      {/* Mobile Wrapper */}
      <div className="w-full max-w-md bg-[#FAFAFA] min-h-screen relative flex flex-col md:border-x md:border-gray-200">
        
        {/* Header */}
        <header className="px-6 pt-6 pb-6 flex items-start justify-between sticky top-0 bg-[#FAFAFA]/90 backdrop-blur-xl z-20">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              Good evening, Dipen 👋
            </h1>
            <p className="text-sm font-medium text-[#6B7280] mt-1">
              Find people to do things with.
            </p>
          </div>
          <button className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm text-[#111827] hover:bg-gray-50 transition-colors">
            <Search className="w-5 h-5" />
          </button>
        </header>

        {/* Directory Grid */}
        <main className="flex-1 px-6 pb-8">
          <div className="grid grid-cols-2 gap-4">
            {dbCategories.map((cat) => (
              <Link 
                key={cat.id} 
                href={`/category/${cat.id}`}
                className="bg-white rounded-[24px] p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 flex flex-col justify-between aspect-square transition-transform active:scale-[0.96] cursor-pointer hover:shadow-[0px_8px_30px_rgba(0,0,0,0.06)] group"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-gray-50 border border-gray-100 group-hover:bg-gray-100 transition-colors">
                  {cat.emoji}
                </div>
                
                <div className="flex flex-col gap-1 mt-4">
                  <h2 className="text-lg font-bold text-[#111827] tracking-tight leading-none">
                    {cat.name}
                  </h2>
                  <span className="text-sm font-medium text-[#6B7280]">
                    {counts[cat.id] || 0} active
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </main>

        {/* Bottom Navigation (Fixed) */}
        <nav className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-0 bg-white border-t border-gray-100 pb-safe z-50">
          <div className="max-w-md mx-auto flex items-center justify-around h-20 px-4">
            <button className="p-3 text-[#111827] hover:bg-gray-50 rounded-2xl transition-colors">
              <Home className="w-6 h-6 stroke-[2.5]" />
            </button>
            <button className="p-3 text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] rounded-2xl transition-colors">
              <Search className="w-6 h-6 stroke-[2.5]" />
            </button>
            
            {/* Create Button (Normal) */}
            <button className="p-3 text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] rounded-2xl transition-colors">
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>

            <button className="p-3 text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] rounded-2xl transition-colors">
              <Building2 className="w-6 h-6 stroke-[2.5]" />
            </button>
            <button className="p-3 text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] rounded-2xl transition-colors">
              <User className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>
        </nav>

      </div>
    </div>
  );
}
