"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X, MapPin, Clock, ArrowRight, Loader2, Plus } from "lucide-react";
import { createConversation } from "@/app/actions/conversation";
import { getPlacePredictions } from "@/app/actions/places";
function PlacesAutocompleteInput() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<{ mainText: string; fullAddress: string; secondaryText?: string } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length > 0) {
      const timer = setTimeout(async () => {
        const results = await getPlacePredictions(query, coords?.lat, coords?.lng);
        setSuggestions(results);
        setIsOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [query, coords]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => {
    if (suggestions.length > 0) setIsOpen(true);
    if (!coords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Location access denied/failed:", err)
      );
    }
  };

  if (selectedPlace) {
    return (
      <div className="w-full px-6 py-5">
        <input type="hidden" name="location" value={selectedPlace.fullAddress} />
        <div className="flex items-center gap-3 bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl px-4 py-3 shadow-sm transition-all relative overflow-hidden group">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
            <MapPin className="w-5 h-5 text-[#4F46E5]" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[15px] font-bold text-[#111827] truncate leading-tight">{selectedPlace.mainText}</span>
            {selectedPlace.secondaryText && (
              <span className="text-xs font-medium text-[#4F46E5]/80 truncate mt-0.5">{selectedPlace.secondaryText}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedPlace(null)}
            className="p-2 text-[#4F46E5] hover:bg-white rounded-full transition-colors shrink-0 opacity-80 hover:opacity-100"
            title="Remove location"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input type="hidden" name="location" value="" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        placeholder="Where? (optional)"
        className="w-full px-6 py-5 text-base font-medium text-[#111827] placeholder:text-gray-400 focus:outline-none bg-transparent"
        autoComplete="off"
      />
      
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-[calc(100%-48px)] mx-6 bg-white border border-gray-100 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
          <div className="max-h-60 overflow-y-auto hide-scrollbar">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => {
                  const fullAddress = suggestion.mainText + (suggestion.secondaryText ? `, ${suggestion.secondaryText}` : "");
                  setSelectedPlace({
                    mainText: suggestion.mainText,
                    secondaryText: suggestion.secondaryText,
                    fullAddress
                  });
                  setQuery("");
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-[#4F46E5]" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-semibold text-[#111827] truncate">{suggestion.mainText}</span>
                  {suggestion.secondaryText && (
                    <span className="text-xs text-gray-500 truncate">{suggestion.secondaryText}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationForm({
  loading,
  setLoading,
  selectedCategory,
  setSelectedCategory,
  hideCategorySelection,
  categories
}: {
  loading: boolean;
  setLoading: (v: boolean) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  hideCategorySelection: boolean;
  categories: { id: string; name: string; emoji: string; }[];
}) {
  return (
    <main className="flex-1 px-6 pt-6 pb-32 overflow-y-auto hide-scrollbar">
      <form action={createConversation} onSubmit={() => setLoading(true)} className="flex flex-col gap-8 h-full">
        
        {/* Native-Style Input Stack */}
        <div className="bg-white border border-gray-200 rounded-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-[#4F46E5]/20 focus-within:border-[#4F46E5] transition-all">
          <input 
            type="text"
            name="title"
            placeholder="What's the plan?"
            className="w-full px-6 py-6 text-xl font-bold text-[#111827] placeholder:text-gray-400 focus:outline-none bg-transparent"
            required
            autoFocus
            autoComplete="off"
          />
          
          <hr className="border-t border-gray-200 mx-6" />

          <PlacesAutocompleteInput />

          <hr className="border-t border-gray-200 mx-6" />
          
          <textarea 
            name="description"
            placeholder="Any extra details? (optional)"
            className="w-full px-6 py-5 text-base font-medium text-[#6B7280] placeholder:text-gray-400 focus:outline-none bg-transparent resize-none min-h-[100px]"
          />
        </div>

        {/* Hidden Category Input */}
        <input type="hidden" name="categoryId" value={selectedCategory} />

        {/* Category Pills (Hidden if Deep Linked) */}
        {!hideCategorySelection && (
          <div className="flex flex-col gap-3 px-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Category</span>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${
                    selectedCategory === cat.id 
                      ? "bg-[#111827] text-white border-[#111827] shadow-md" 
                      : "bg-white text-[#6B7280] border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg leading-none">{cat.emoji}</span>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sticky Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 md:absolute bg-gradient-to-t from-white via-white to-transparent pt-12 p-4 pb-safe z-30">
          <button 
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-[#4F46E5]/70 text-white text-lg font-bold rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md shadow-[#4F46E5]/20"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                Start Conversation
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

      </form>
    </main>
  );
}

function CreateForm() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");

  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(categoryParam || "sports");

  const hideCategorySelection = !!categoryParam;

  const categories = [
    { id: "sports", name: "Sports", emoji: "🏸" },
    { id: "movies", name: "Movies", emoji: "🎬" },
    { id: "food", name: "Food", emoji: "🍔" },
    { id: "fitness", name: "Fitness", emoji: "🏃" },
    { id: "gaming", name: "Gaming", emoji: "🎮" },
    { id: "music", name: "Music", emoji: "🎸" },
  ];

  const categoryName = categories.find(c => c.id === selectedCategory)?.name || "Plan";

  return (
    <div className="min-h-screen bg-white flex justify-center font-sans">
      
      {/* Mobile Wrapper */}
      <div className="w-full max-w-md bg-white min-h-screen relative flex flex-col md:border-x md:border-gray-200 shadow-sm">
        
        {/* Header */}
        <header className="px-6 pt-6 pb-4 flex items-center justify-between z-20">
          <Link href={categoryParam ? `/category/${categoryParam}` : "/feed"} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-[#111827] hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </Link>
          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">New {categoryName} Plan</span>
          <div className="w-10 h-10" /> {/* Spacer */}
        </header>

        {/* Minimalist Form Component */}
        <ConversationForm 
          loading={loading}
          setLoading={setLoading}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          hideCategorySelection={hideCategorySelection}
          categories={categories}
        />
      </div>
    </div>
  );
}

export default function CreateConversation() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex justify-center font-sans">
        <div className="w-full max-w-md bg-white min-h-screen relative md:border-x md:border-gray-200" />
      </div>
    }>
      <CreateForm />
    </Suspense>
  );
}
