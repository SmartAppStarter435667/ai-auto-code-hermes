"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Key, 
  LogOut, 
  Save, 
  ShieldCheck, 
  Settings, 
  Palette,
  CheckCircle2,
  Lock,
  Bot,
  Boxes,
  Triangle,
  Layout,
  Database,
  Cloud,
  Globe,
  MessageSquare,
  FileText,
  Workflow,
  PenTool,
  Box,
  Eye,
  EyeOff,
  Briefcase,
  Zap,
  Sparkles,
  Github
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useUser } from '@/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SettingsViewProps {
  onLogout: () => void;
  onNavigateToLegal: (page: 'tos' | 'privacy' | 'corporate') => void;
}

export function SettingsView({ onLogout, onNavigateToLegal }: SettingsViewProps) {
  const { user } = useUser();
  const [ghToken, setGhToken] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  
  // MCP Credentials
  const [figmaToken, setFigmaToken] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [googleMcpKey, setGoogleMcpKey] = useState('');
  const [msMcpKey, setMsMcpKey] = useState('');
  const [adobeToken, setAdobeToken] = useState('');
  const [cloudflareToken, setCloudflareToken] = useState('');
  
  // External AI Connectors
  const [claudeKey, setClaudeKey] = useState('');
  const [chatgptKey, setChatgptKey] = useState('');

  const [language, setLanguage] = useState('Japanese');
  const [theme, setTheme] = useState('dark');
  const [isSaved, setIsSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    setGhToken(localStorage.getItem('gh_token') || '');
    setGeminiKey(localStorage.getItem('GEMINI_API_KEY') || '');
    setGroqKey(localStorage.getItem('GROQ_API_KEY') || '');
    setFigmaToken(localStorage.getItem('mcp_figma_token') || '');
    setNotionToken(localStorage.getItem('mcp_notion_token') || '');
    setGoogleMcpKey(localStorage.getItem('mcp_google_workspace_key') || '');
    setMsMcpKey(localStorage.getItem('mcp_ms365_key') || '');
    setAdobeToken(localStorage.getItem('mcp_adobe_token') || '');
    setCloudflareToken(localStorage.getItem('mcp_cloudflare_token') || '');
    setClaudeKey(localStorage.getItem('mcp_claude_key') || '');
    setChatgptKey(localStorage.getItem('mcp_chatgpt_key') || '');

    setLanguage(localStorage.getItem('ca_preferred_language') || 'Japanese');
    setTheme(localStorage.getItem('ca_app_theme') || 'dark');
  }, []);

  const handleSave = () => {
    localStorage.setItem('gh_token', ghToken);
    localStorage.setItem('GEMINI_API_KEY', geminiKey);
    localStorage.setItem('GROQ_API_KEY', groqKey);
    localStorage.setItem('mcp_figma_token', figmaToken);
    localStorage.setItem('mcp_notion_token', notionToken);
    localStorage.setItem('mcp_google_workspace_key', googleMcpKey);
    localStorage.setItem('mcp_ms365_key', msMcpKey);
    localStorage.setItem('mcp_adobe_token', adobeToken);
    localStorage.setItem('mcp_cloudflare_token', cloudflareToken);
    localStorage.setItem('mcp_claude_key', claudeKey);
    localStorage.setItem('mcp_chatgpt_key', chatgptKey);

    localStorage.setItem('ca_preferred_language', language);
    localStorage.setItem('ca_app_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    setIsSaved(true);
    toast({ title: "System Vault Updated", description: "All AI, MCP, and external credentials saved." });
    setTimeout(() => { setIsSaved(false); }, 800);
  };

  const confirmUnlock = () => {
    setShowApiKey(true);
    setIsAuthDialogOpen(false);
    toast({ title: "Vault Unlocked" });
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden w-full">
      <header className="p-8 border-b border-border bg-card/30 backdrop-blur-md shrink-0">
        <h2 className="text-2xl font-headline font-bold flex items-center gap-3 text-foreground">
          <ShieldCheck className="text-primary w-7 h-7" /> System Vault & Preferences
        </h2>
      </header>

      <ScrollArea className="flex-1 w-full">
        <div className="p-8 space-y-8 max-w-3xl mx-auto pb-24 w-full">
          
          <Card className="border-border rounded-[2.5rem] overflow-hidden border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader className="border-b border-primary/10 flex flex-row items-center justify-between p-6">
              <CardTitle className="text-sm font-headline flex items-center gap-2 text-primary uppercase tracking-widest font-bold">
                <Bot className="w-4 h-4" /> AI Intelligence Core (Groq + Gemini)
              </CardTitle>
              <Button onClick={handleSave} size="sm" className="h-9 rounded-xl gap-2 text-[10px] font-bold uppercase tracking-widest px-4 shadow-lg">
                <Save className="w-3.5 h-3.5" /> Save Changes
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] uppercase font-bold text-primary tracking-widest">Groq Cloud API Key (Default Engine)</Label>
                  {!showApiKey && <Button variant="ghost" className="h-5 p-0 text-[9px] uppercase text-primary font-bold" onClick={() => setIsAuthDialogOpen(true)}>Unlock Vault</Button>}
                </div>
                <div className="relative">
                  <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                  <Input type={showApiKey ? "text" : "password"} value={groqKey} onChange={(e) => setGroqKey(e.target.value)} disabled={!showApiKey} className="pl-12 bg-background h-14 rounded-2xl border-border/60 focus:border-primary" placeholder="gsk_..." />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Gemini / Google AI Key (Fallback Engine)</Label>
                <div className="relative">
                  <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                  <Input type={showApiKey ? "text" : "password"} value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} disabled={!showApiKey} className="pl-12 bg-background h-14 rounded-2xl" placeholder="AIza..." />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">GitHub Personal Token</Label>
                <div className="relative">
                  <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
                  <Input type={showApiKey ? "text" : "password"} value={ghToken} onChange={(e) => setGhToken(e.target.value)} disabled={!showApiKey} className="pl-12 bg-background h-14 rounded-2xl" placeholder="ghp_..." />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border rounded-[2.5rem] overflow-hidden border-purple-500/20 bg-purple-500/5 shadow-sm">
            <CardHeader className="border-b border-purple-500/10 p-6">
              <CardTitle className="text-sm font-headline flex items-center gap-2 text-purple-400 uppercase tracking-widest font-bold">
                <Boxes className="w-4 h-4" /> Universal MCP Connector Vault
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2 tracking-widest"><Globe className="w-3.5 h-3.5 text-blue-500"/> Google Workspace</Label>
                  <Input type={showApiKey ? "text" : "password"} value={googleMcpKey} onChange={(e) => setGoogleMcpKey(e.target.value)} disabled={!showApiKey} placeholder="OAuth/API Key" className="bg-background h-14 rounded-2xl" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2 tracking-widest"><Triangle className="w-3.5 h-3.5 text-blue-600 rotate-180"/> Microsoft 365</Label>
                  <Input type={showApiKey ? "text" : "password"} value={msMcpKey} onChange={(e) => setMsMcpKey(e.target.value)} disabled={!showApiKey} placeholder="MS Graph Token" className="bg-background h-14 rounded-2xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2 tracking-widest"><MessageSquare className="w-3.5 h-3.5 text-orange-500"/> Claude (Anthropic)</Label>
                  <Input type={showApiKey ? "text" : "password"} value={claudeKey} onChange={(e) => setClaudeKey(e.target.value)} disabled={!showApiKey} placeholder="sk-ant-..." className="bg-background h-14 rounded-2xl" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2 tracking-widest"><Bot className="w-3.5 h-3.5 text-emerald-500"/> ChatGPT (OpenAI)</Label>
                  <Input type={showApiKey ? "text" : "password"} value={chatgptKey} onChange={(e) => setChatgptKey(e.target.value)} disabled={!showApiKey} placeholder="sk-..." className="bg-background h-14 rounded-2xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2 tracking-widest"><PenTool className="w-3.5 h-3.5 text-red-500"/> Adobe CC / Figma</Label>
                  <Input type={showApiKey ? "text" : "password"} value={adobeToken} onChange={(e) => setAdobeToken(e.target.value)} disabled={!showApiKey} placeholder="Integration Token" className="bg-background h-14 rounded-2xl" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2 tracking-widest"><Workflow className="w-3.5 h-3.5 text-foreground"/> Notion / Slack</Label>
                  <Input type={showApiKey ? "text" : "password"} value={notionToken} onChange={(e) => setNotionToken(e.target.value)} disabled={!showApiKey} placeholder="Secret Token" className="bg-background h-14 rounded-2xl" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border rounded-[2.5rem] overflow-hidden shadow-sm">
            <CardHeader className="border-b border-border bg-muted/30 p-6">
              <CardTitle className="text-sm font-headline flex items-center gap-2 uppercase tracking-widest font-bold"><Palette className="w-4 h-4 text-primary" /> Workspace Preferences</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Button variant={theme === 'light' ? 'default' : 'outline'} className="rounded-2xl h-14 font-bold gap-3 shadow-sm transition-all" onClick={() => setTheme('light')}><Eye className="w-5 h-5" /> Standard Light</Button>
                <Button variant={theme === 'dark' ? 'default' : 'outline'} className="rounded-2xl h-14 font-bold gap-3 shadow-sm transition-all" onClick={() => setTheme('dark')}><EyeOff className="w-5 h-5" /> Pro Dark</Button>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold tracking-widest">Interface Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="bg-background border-border h-14 rounded-2xl"><SelectValue placeholder="Select Language" /></SelectTrigger>
                  <SelectContent className="bg-card border-border rounded-xl">
                    <SelectItem value="Japanese">日本語 (Japanese)</SelectItem>
                    <SelectItem value="English">English (Global)</SelectItem>
                    <SelectItem value="Korean">한국어 (Korean)</SelectItem>
                    <SelectItem value="Chinese">中文 (Chinese)</SelectItem>
                    <SelectItem value="French">Français</SelectItem>
                    <SelectItem value="German">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-6 pb-12">
            <Button onClick={handleSave} className={cn("h-16 rounded-[1.5rem] gap-3 font-headline text-sm transition-all shadow-2xl", isSaved ? "bg-green-600" : "bg-primary shadow-primary/20")}>
              {isSaved ? <CheckCircle2 className="w-6 h-6" /> : <Save className="w-6 h-6" />}
              Synchronize All
            </Button>
            <Button onClick={onLogout} variant="outline" className="h-16 rounded-[1.5rem] gap-3 font-headline text-sm border-destructive/20 text-destructive hover:bg-destructive/5">
              <LogOut className="w-6 h-6" /> Terminate Session
            </Button>
          </div>
        </div>
      </ScrollArea>

      <AlertDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
        <AlertDialogContent className="bg-card border-border rounded-[2.5rem] max-w-md p-8">
          <AlertDialogHeader>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Lock className="w-7 h-7" />
              </div>
              <AlertDialogTitle className="text-xl font-headline text-foreground">Access Secure Vault?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Revealing these keys allows access to external professional suites (Drive, Figma, Claude). Only proceed on a private, trusted device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex gap-4">
            <AlertDialogAction onClick={confirmUnlock} className="rounded-2xl h-14 bg-primary flex-1 text-white shadow-lg">Authorize Access</AlertDialogAction>
            <AlertDialogCancel className="rounded-2xl h-14 flex-1 mt-0">Keep Hidden</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}