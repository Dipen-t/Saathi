"use client";

import { useState, useRef } from "react";
import { ArrowRight, ArrowLeft, CheckCircle2, Navigation, Coffee, Film, Dumbbell, Loader2 } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { syncUserAfterLogin } from "@/app/actions/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const otpRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  
  const supabase = createClient();

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (signInError) throw signInError;
      }

      setSuccess(true);
      await syncUserAfterLogin();
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  const activities = [
    { name: "Sports", icon: Navigation, color: "bg-white text-gray-900 border-2 border-gray-100 hover:border-gray-900" },
    { name: "Cafe", icon: Coffee, color: "bg-white text-gray-900 border-2 border-gray-100 hover:border-gray-900" },
    { name: "Movies", icon: Film, color: "bg-white text-gray-900 border-2 border-gray-100 hover:border-gray-900" },
    { name: "Fitness", icon: Dumbbell, color: "bg-white text-gray-900 border-2 border-gray-100 hover:border-gray-900" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 md:p-4 lg:p-8">
      
      <div className="w-full flex md:rounded-[2.5rem] overflow-hidden bg-white shadow-[0px_20px_40px_rgba(0,0,0,0.06)] md:border md:border-gray-100">
        
        {/* Left Side: Desktop Collage Hero with Diagonal Cut */}
        <div 
          className="relative hidden md:block md:w-1/2 lg:w-3/5 shrink-0 bg-gray-100"
          style={{ clipPath: "polygon(0 0, 100% 0, 85% 100%, 0% 100%)" }}
        >
          <Image 
            src="/collage-abc.png"
            alt="Modern Indians enjoying local activities"
            fill
            sizes="(max-width: 768px) 0vw, (max-width: 1024px) 50vw, 60vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-16 left-12 right-24 text-white">
            <h2 className="text-5xl font-extrabold tracking-tighter drop-shadow-lg mb-3">Meet your local scene.</h2>
            <p className="text-xl font-medium text-white/90 drop-shadow-md">Sports, Cafes, Movies & Fitness.</p>
          </div>
        </div>

        {/* Right Side / Mobile Main: Content Area */}
        <main className="flex-1 w-full flex flex-col relative md:justify-center px-6 pt-0 pb-8 md:p-12 lg:p-20 z-10 bg-white md:bg-transparent">
          
          {/* Mobile-only Hero Banner with Angled Bottom */}
          <div 
            className="md:hidden relative h-[40vh] min-h-[300px] w-[calc(100%+3rem)] -ml-6 mb-8 shrink-0 bg-gray-100 shadow-sm"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 85%, 0% 100%)" }}
          >
            <Image 
              src="/collage-abc.png"
              alt="Modern Indians enjoying local activities"
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-12 left-6 right-6 text-white">
              <h2 className="text-4xl font-extrabold tracking-tighter drop-shadow-md mb-2">Meet your local scene.</h2>
              <p className="text-base font-medium text-white/90 drop-shadow-sm">Sports, Cafes, Movies & Fitness.</p>
            </div>
          </div>

          {/* Form Container */}
          <div className="flex flex-col w-full max-w-sm mx-auto md:ml-0 md:mr-auto">
            <div className="mb-8 hidden md:block">
              <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tighter text-gray-900 mb-3 leading-none">
                Let's get started
              </h1>
              <p className="text-gray-500 font-medium text-lg">
                Enter your email to jump in.
              </p>
            </div>
            
            <div className="mb-8 md:hidden text-center flex flex-col items-center">
              <h1 className="text-3xl font-extrabold tracking-tighter text-gray-900 mb-2">
                Let's get started
              </h1>
              <p className="text-gray-500 font-medium text-base">
                Enter your email to jump in.
              </p>
            </div>

            <div className="flex-1 w-full">
              {!success ? (
                <form onSubmit={handleAuthSubmit} className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col gap-4">
                    <input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-16 px-6 rounded-full bg-gray-50/80 border-2 border-gray-100 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] focus:bg-white transition-all shadow-sm"
                      autoFocus
                    />
                    <input
                      id="password"
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-16 px-6 rounded-full bg-gray-50/80 border-2 border-gray-100 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] focus:bg-white transition-all shadow-sm"
                    />
                    {error && <p className="text-sm font-medium text-red-500 text-left ml-4">{error}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-16 bg-[#4F46E5] hover:bg-[#4338CA] disabled:bg-[#4F46E5]/70 text-white text-lg font-bold rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-[#4F46E5]/30"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      <>
                        {isSignUp ? "Sign Up" : "Log In"}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-sm font-bold text-gray-500 hover:text-[#111827] mt-2 transition-colors"
                  >
                    {isSignUp ? "Already have an account? Log In" : "Don't have an account? Sign Up"}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-5 animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-inner shadow-green-100">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-extrabold tracking-tighter text-gray-900">You're in!</h2>
                  <p className="text-gray-500 font-medium text-center">Finding activities near you...</p>
                </div>
              )}
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}
