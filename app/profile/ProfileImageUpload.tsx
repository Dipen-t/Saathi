"use client";

import { useState, useRef, useTransition } from "react";
import { Camera, Loader2, User as UserIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { updateUserAvatar } from "@/app/actions/auth";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function ProfileImageUpload({ currentAvatar, userId }: { currentAvatar: string | null, userId: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}-${Math.random()}.${fileExt}`;

      // Upload image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      // Update Database
      startTransition(async () => {
        await updateUserAvatar(publicUrl);
        router.refresh();
      });

    } catch (error: any) {
      alert("Error uploading avatar: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative group">
      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl bg-gray-100 flex items-center justify-center relative z-10">
        {currentAvatar ? (
          <Image 
            src={currentAvatar} 
            alt="Profile Avatar" 
            fill 
            className="object-cover"
            sizes="128px"
            priority
          />
        ) : (
          <UserIcon className="w-12 h-12 text-gray-400" />
        )}
        
        {/* Loading Overlay */}
        {(isUploading || isPending) && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm z-20">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || isPending}
        className="absolute bottom-1 right-1 w-10 h-10 bg-[#111827] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-black transition-transform active:scale-95 z-30"
      >
        <Camera className="w-4 h-4" />
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
