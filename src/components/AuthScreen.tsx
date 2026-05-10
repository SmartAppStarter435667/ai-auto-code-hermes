"use client"

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Lock, Sparkles, Loader2, Globe, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function AuthScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Auth Error:", error);
      let errorMessage = error.message;
      
      if (error.code === 'auth/invalid-api-key' || error.code === 'auth/api-key-not-found') {
        errorMessage = "Firebase API Key is missing or invalid. Please check src/firebase/config.ts";
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = "Google Auth is not enabled in Firebase Console.";
      }
      
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSession = async () => {
    if (!auth) return;
    setIsLoading(true);
    try {
      localStorage.removeItem('gh_token');
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (k.startsWith('ca_chat_history_')) localStorage.removeItem(k);
      });
      await signOut(auth);
      
      toast({
        title: "Session Reset",
        description: "Credentials cleared. Please try signing in again.",
      });
    } catch (e) {
      console.error("Reset Error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password) return;
    setIsLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: mode === 'signin' ? "Sign In Error" : "Sign Up Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center p-6 py-12 overflow-y-auto scrollbar-hide">
      <div className="w-full max-w-md my-auto animate-in fade-in zoom-in duration-500 flex flex-col items-center">
        <div className="text-center mb-10 space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/20 animate-pulse">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm font-medium opacity-80">
              The Next Generation of Autonomous AI Coding
            </p>
          </div>
        </div>

        <Card className="border-white/5 bg-[#1a1a1a]/80 backdrop-blur-xl shadow-2xl rounded-[2.5rem] overflow-hidden w-full">
          <CardContent className="p-8 space-y-8">
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full h-14 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 text-white font-headline font-bold text-base transition-all gap-3"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
              
              <button 
                onClick={handleResetSession}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-white transition-colors py-2"
              >
                <RefreshCcw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                Clear Session & Retry
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/5"></span>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground bg-transparent">
                <span className="bg-[#1a1a1a] px-4">Or use email</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-transparent focus:border-primary/50 h-14 rounded-2xl pl-12 text-base transition-all"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/5 border-transparent focus:border-primary/50 h-14 rounded-2xl pl-12 text-base transition-all"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 rounded-2xl font-headline font-bold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all" 
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'signin' ? 'Sign In' : 'Create Account')}
              </Button>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="text-xs font-bold text-primary hover:underline transition-all opacity-80 hover:opacity-100"
                >
                  {mode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground opacity-40 pb-12">
          <Globe className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Available in Google Service Regions</span>
        </div>
      </div>
    </div>
  );
}
