"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Onboarding() {
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();

  const interests = [
    { id: "sports", name: "Sports", emoji: "🏸" },
    { id: "movies", name: "Movies", emoji: "🎬" },
    { id: "food", name: "Food", emoji: "🍔" },
    { id: "fitness", name: "Fitness", emoji: "🏃" },
    { id: "gaming", name: "Gaming", emoji: "🎮" },
    { id: "music", name: "Music", emoji: "🎸" },
    { id: "coding", name: "Coding", emoji: "💻" },
  ];

  const toggleInterest = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((item) => item !== id));
    } else {
      if (selected.length < 5) {
        setSelected([...selected, id]);
      }
    }
  };

  const handleContinue = () => {
    if (selected.length >= 3) {
      router.push("/feed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center md:p-4 lg:p-8">
      <div className="w-full max-w-md bg-white min-h-screen md:min-h-0 md:rounded-[2.5rem] shadow-[0px_20px_40px_rgba(0,0,0,0.06)] md:border md:border-gray-100 flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <header className="px-6 pt-16 pb-8 bg-white sticky top-0 z-20">
          <div className="w-12 h-12 bg-[#4F46E5]/10 text-[#4F46E5] rounded-2xl flex items-center justify-center mb-6">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tighter text-gray-900 mb-2 leading-none">
            What are you into?
          </h1>
          <p className="text-gray-500 font-medium text-lg">
            Pick 3 to 5 interests to shape your local feed.
          </p>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 pb-32 overflow-y-auto hide-scrollbar">
          <div className="flex flex-wrap gap-3">
            {interests.map((interest, idx) => {
              const isSelected = selected.includes(interest.id);
              const isDisabled = !isSelected && selected.length >= 5;

              return (
                <button
                  key={interest.id}
                  onClick={() => toggleInterest(interest.id)}
                  disabled={isDisabled}
                  className={`
                    animate-in fade-in zoom-in-95 duration-500 fill-mode-both flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-lg font-bold border-2 transition-all active:scale-95
                    ${isSelected 
                      ? "border-[#4F46E5] bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/30" 
                      : isDisabled 
                        ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed" 
                        : "border-gray-100 bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50"}
                  `}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <span className="text-2xl">{interest.emoji}</span>
                  {interest.name}
                </button>
              );
            })}
          </div>
        </main>

        {/* Footer / Floating Action */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent z-10 pt-12">
          <button 
            onClick={handleContinue}
            disabled={selected.length < 3}
            className="w-full h-16 bg-gray-900 hover:bg-black disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 text-white text-lg font-bold rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-gray-900/20"
          >
            {selected.length < 3 ? `Pick ${3 - selected.length} more` : "Continue"}
            {selected.length >= 3 && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>

      </div>
    </div>
  );
}
