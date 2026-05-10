"use client"

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  Sparkles, 
  HelpCircle, 
  Loader2, 
  ChevronRight,
  Info,
  GripHorizontal,
  Headphones
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getUserInteractionLogs } from '@/lib/interaction-logger';
import { askSupportAssistant } from '@/ai/flows/support-assistant-flow';
import { motion, useDragControls } from 'framer-motion';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface GlobalAssistantChatProps {
  currentTab: string;
}

export function GlobalAssistantChat({ currentTab }: GlobalAssistantChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'こんにちは！このアプリの操作方法や機能について何かお手伝いできることはありますか？' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      const logs = getUserInteractionLogs();
      const result = await askSupportAssistant({
        userMessage: userMsg,
        interactionLogs: logs.map(l => ({ timestamp: l.timestamp, type: l.type, detail: l.detail })),
        currentTab: currentTab,
        language: localStorage.getItem('ca_preferred_language') || 'Japanese'
      });

      setMessages(prev => [...prev, { role: 'ai', content: result.reply }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'ai', content: '申し訳ありません。エラーが発生しました。もう一度お試しください。' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div 
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.05}
      initial={{ x: 0, y: 0 }}
      whileDrag={{ scale: 1.02 }}
      className="fixed bottom-24 right-6 z-[200] flex flex-col items-end"
    >
      {isOpen && (
        <Card className="w-[320px] sm:w-[400px] h-[500px] mb-4 bg-card/95 backdrop-blur-2xl border-border shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 pointer-events-auto rounded-[2.5rem]">
          <header 
            className="h-16 bg-primary p-5 flex items-center justify-between shrink-0 cursor-move"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-white font-headline leading-tight">AI Concierge</h3>
                <span className="text-[9px] text-white/70 uppercase tracking-widest font-bold">Live Support</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
              className="text-white hover:bg-white/10 rounded-full h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </header>
          
          <ScrollArea className="flex-1 p-6 bg-muted/5">
            <div className="space-y-6">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex gap-3", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    m.role === 'user' ? "bg-primary text-white" : "bg-card border border-border text-primary"
                  )}>
                    {m.role === 'user' ? <Info className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-[13px] max-w-[85%] leading-relaxed shadow-sm",
                    m.role === 'user' ? "bg-primary text-white rounded-tr-none" : "bg-card border border-border rounded-tl-none"
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-primary" /></div>
                  <div className="bg-card border border-border p-4 rounded-2xl rounded-tl-none shadow-sm"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="p-5 border-t border-border bg-card">
            <div className="flex gap-2 relative">
              <Input 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="How can I help you today?" 
                className="bg-muted/30 border-transparent h-12 rounded-2xl text-xs pr-12 focus-visible:ring-primary/30"
              />
              <Button size="icon" onClick={handleSendMessage} disabled={!input.trim() || isTyping} className="absolute right-1 top-1 h-10 w-10 rounded-xl shadow-lg shadow-primary/20 bg-primary">
                <Send className="w-4 h-4 text-white" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Button 
        onPointerDown={(e) => dragControls.start(e)}
        onClick={() => setIsOpen(!isOpen)} 
        className={cn(
          "w-16 h-16 rounded-full shadow-2xl transition-all active:scale-90 pointer-events-auto flex items-center justify-center cursor-move",
          isOpen ? "bg-card border border-border text-primary rotate-90" : "bg-primary text-white hover:scale-105"
        )}
      >
        {isOpen ? <X className="w-7 h-7" /> : <Headphones className="w-7 h-7" />}
      </Button>
    </motion.div>
  );
}
