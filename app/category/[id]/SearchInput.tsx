"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export default function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set('q', term);
    } else {
      params.delete('q');
    }
    
    // We use router.replace to not push history state for every keystroke
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          type="text" 
          defaultValue={searchParams.get('q')?.toString() || ''}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search conversations..." 
          className="w-full h-12 pl-11 pr-4 bg-white rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all"
        />
        {isPending && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        )}
      </div>
      <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#111827] hover:bg-gray-50 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <SlidersHorizontal className="w-4 h-4" />
      </button>
    </div>
  );
}
