"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Github, Key, ShieldCheck } from "lucide-react";

interface GitHubLoginProps {
  onLogin: (token: string) => void;
}

export function GitHubLogin({ onLogin }: GitHubLoginProps) {
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      localStorage.setItem('gh_token', token.trim());
      onLogin(token.trim());
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#121212] flex flex-col items-center p-6 py-12 scrollbar-hide">
      <div className="w-full max-w-md my-auto animate-in fade-in zoom-in duration-500">
        <Card className="border-white/5 bg-[#1a1a1a] shadow-2xl rounded-[2rem] overflow-hidden">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center shadow-inner">
              <Github className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-1">
              <CardDescription className="text-muted-foreground text-sm">
                Autonomous AI coding at your fingertips.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70 ml-1">
                  <Key className="w-3 h-3" />
                  <span>Personal Access Token</span>
                </div>
                <Input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="bg-white/5 border-transparent focus:border-primary/50 h-14 rounded-2xl text-base px-5 transition-all shadow-xl"
                  autoComplete="off"
                />
              </div>
              
              <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10 flex gap-4 items-start">
                <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-0.5 opacity-80" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Tokens are stored securely in your browser's local storage and used only for direct GitHub API requests. No data ever leaves your device except to GitHub.
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 rounded-2xl font-headline font-bold text-base shadow-lg shadow-primary/20 active:scale-[0.98] transition-all" 
                disabled={!token.trim()}
              >
                Connect GitHub Account
              </Button>
            </form>
            
            <div className="mt-8 text-center">
              <p className="text-[10px] text-muted-foreground font-medium opacity-40 hover:opacity-100 transition-opacity cursor-default">
                VERSION 1.0 • PWA ENABLED • SECURE VAULT
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
