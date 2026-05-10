"use client"

import React, { useState, useEffect, useRef } from 'react';
import { 
  GitHubRepo, 
  GitHubContent, 
  fetchContents, 
  fetchFileContent, 
  fetchIssues, 
  GitHubIssue,
  createCommit 
} from '@/app/lib/github';
import { 
  File, 
  Folder, 
  ChevronLeft, 
  Send, 
  Bot, 
  Cpu, 
  Code2, 
  ArrowLeft,
  Settings,
  AlertCircle,
  Hash,
  ChevronDown,
  Clock
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { contextAwareCodeImprovement } from "@/ai/flows/context-aware-code-improvement";
import { cn } from "@/lib/utils";

interface EditorSplitViewProps {
  token: string;
  repo: GitHubRepo;
  onBack: () => void;
}

interface ChatMessage {
  role: 'user' | 'ai' | 'system';
  content: string;
  status?: string;
}

const MODELS = [
  { id: 'googleai/gemini-3.1-flash-lite-preview', name: '3.1 Flash Lite', provider: 'Google' },
  { id: 'googleai/gemini-3-flash-preview', name: '3.0 Flash', provider: 'Google' },
  { id: 'googleai/gemini-3.1-pro-preview', name: '3.1 Pro', provider: 'Google' },
];

export function EditorSplitView({ token, repo, onBack }: EditorSplitViewProps) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [contents, setContents] = useState<GitHubContent[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitHubContent | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [view, setView] = useState<'files' | 'issues'>('files');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getLanguage = () => localStorage.getItem('ca_preferred_language') || 'Japanese';

  useEffect(() => {
    const lang = getLanguage();
    const welcome = lang === 'Japanese' 
      ? `こんにちは！${repo.name} のAIアシスタントです。ファイルを選択して作業を開始しましょう。リポジトリ全体についての質問も可能です。`
      : `Hello! I'm your AI assistant for ${repo.name}. Select a file or ask me general questions about the repository.`;
    setChatMessages([{ role: 'ai', content: welcome }]);
    loadContents();
    loadIssues();
  }, [repo]);

  useEffect(() => {
    loadContents();
  }, [currentPath]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isProcessing]);

  useEffect(() => {
    if (isProcessing) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isProcessing]);

  const loadContents = async () => {
    try {
      const data = await fetchContents(token, repo.full_name, currentPath.join('/'));
      setContents(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadIssues = async () => {
    try {
      const data = await fetchIssues(token, repo.full_name);
      setIssues(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileSelect = async (file: GitHubContent) => {
    if (file.type === 'dir') {
      setCurrentPath([...currentPath, file.name]);
    } else {
      try {
        const fullFile = await fetchFileContent(token, repo.full_name, file.path);
        setSelectedFile(fullFile);
        if (fullFile.content) {
          const cleanedContent = fullFile.content.replace(/\s/g, '');
          setFileContent(atob(cleanedContent));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const navigateBack = () => {
    if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  const handleIssueSelect = (issue: GitHubIssue) => {
    const lang = getLanguage();
    const prefix = lang === 'Japanese' ? "このイシューを解決して" : `Resolve this issue in ${lang}`;
    setUserInput(`${prefix}: #${issue.number} ${issue.title}`);
    setView('files');
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isProcessing) return;

    const userQuery = userInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    setUserInput('');
    setIsProcessing(true);
    setProcessingStatus(`Analyzing with ${selectedModel.name}...`);

    try {
      const lang = getLanguage();
      const userApiKey = localStorage.getItem('GEMINI_API_KEY') || '';
      
      const result = await contextAwareCodeImprovement({
        instruction: userQuery,
        code: selectedFile ? fileContent : '',
        githubIssues: issues.map(i => ({
          title: i.title,
          body: i.body,
          url: i.url
        })),
        modelId: selectedModel.id,
        language: lang,
        userApiKey: userApiKey
      });

      setProcessingStatus('Finalizing...');
      
      const appliedMsg = selectedFile && result.fileChanges?.some(f => f.file === selectedFile.path)
        ? (lang === 'Japanese' 
            ? "\n\n✅ 変更をエディタに適用しました。"
            : "\n\n✅ Changes applied to the editor.")
        : "";

      setChatMessages(prev => [...prev, { 
        role: 'ai', 
        content: result.explanation + appliedMsg
      }]);

      if (selectedFile) {
        const relevantChange = result.fileChanges?.find(f => f.file === selectedFile.path);
        if (relevantChange) setFileContent(relevantChange.content);
      }

    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'system', content: `Error: ${e.message}` }]);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleCommit = async () => {
    if (!selectedFile || !fileContent) return;
    
    setIsProcessing(true);
    setProcessingStatus('Pushing to GitHub...');
    
    try {
      const lang = getLanguage();
      const commitMsg = lang === 'Japanese' 
        ? `AI アシスタントによる更新 (${selectedModel.name})`
        : `AI generated update via ${selectedModel.name}`;

      await createCommit(
        token, 
        repo.full_name, 
        selectedFile.path, 
        commitMsg, 
        fileContent, 
        selectedFile.sha
      );
      
      const successMsg = lang === 'Japanese' ? "成功！変更がGitHubにコミットされました。" : "Success! Changes committed to GitHub.";
      setChatMessages(prev => [...prev, { role: 'system', content: successMsg }]);
      const updated = await fetchFileContent(token, repo.full_name, selectedFile.path);
      setSelectedFile(updated);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'system', content: `Commit Error: ${e.message}` }]);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] overflow-hidden">
      <header className="h-14 shrink-0 border-b border-border bg-[#1e1e1e] flex items-center px-4 justify-between z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col">
            <h2 className="text-sm font-headline truncate max-w-[120px] text-white">{repo.name}</h2>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              <span className="text-[10px] text-muted-foreground font-mono">main</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-[10px] font-mono gap-1 px-2 border-border/50 bg-[#252525] text-white">
                {selectedModel.name} <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#252525] border-border w-48 text-white">
              {MODELS.map((m) => (
                <DropdownMenuItem 
                  key={m.id} 
                  onClick={() => setSelectedModel(m)}
                  className="text-xs flex justify-between items-center py-2"
                >
                  <span>{m.name}</span>
                  <span className="text-[9px] opacity-40 uppercase">{m.provider}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedFile && (
             <Button 
                variant="default" 
                size="sm" 
                className="bg-primary hover:bg-primary/80 h-8 font-headline text-xs px-3 text-white"
                onClick={handleCommit}
                disabled={isProcessing}
             >
               Commit
             </Button>
          )}
        </div>
      </header>

      <div className="split-top border-b border-border relative overflow-hidden flex flex-col bg-[#1a1a1a]">
        {selectedFile ? (
          <>
            <div className="h-10 bg-[#252525] border-b border-border flex items-center px-4 justify-between shrink-0">
               <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                 <File className="w-3.5 h-3.5 text-primary" />
                 <span className="text-xs font-code truncate text-white">{selectedFile.path}</span>
               </div>
               <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={() => setSelectedFile(null)}>
                 <ChevronLeft className="w-4 h-4" />
               </Button>
            </div>
            <ScrollArea className="flex-1">
              <pre className="p-4 text-[13px] font-code leading-relaxed text-blue-100/90 overflow-x-auto selection:bg-primary/40">
                <code>{fileContent}</code>
              </pre>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="p-4 flex gap-4 border-b border-border bg-[#1e1e1e] shrink-0">
               <Button 
                  variant={view === 'files' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setView('files')}
                  className="rounded-full h-8 px-4 text-white"
               >
                 Files
               </Button>
               <Button 
                  variant={view === 'issues' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setView('issues')}
                  className="rounded-full h-8 px-4 text-white"
               >
                 Issues
               </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-2">
                {view === 'files' ? (
                  <>
                    {currentPath.length > 0 && (
                      <button 
                        onClick={navigateBack}
                        className="w-full text-left p-3 flex items-center gap-3 hover:bg-white/5 transition-colors rounded-lg group"
                      >
                        <Folder className="w-4 h-4 text-primary fill-primary/20" />
                        <span className="text-sm font-medium text-white">..</span>
                      </button>
                    )}
                    {contents.map((item) => (
                      <button 
                        key={item.sha} 
                        onClick={() => handleFileSelect(item)}
                        className="w-full text-left p-3 flex items-center gap-3 hover:bg-white/5 transition-colors rounded-lg"
                      >
                        {item.type === 'dir' ? (
                          <Folder className="w-4 h-4 text-primary fill-primary/20 shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate text-white">{item.name}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="space-y-2 p-2">
                    {issues.map((issue) => (
                      <Card 
                        key={issue.id} 
                        className="p-3 bg-card/40 border-border hover:bg-card/60 transition-all cursor-pointer group rounded-xl overflow-hidden"
                        onClick={() => handleIssueSelect(issue)}
                      >
                        <div className="flex gap-3">
                           <AlertCircle className="w-4 h-4 text-green-500 shrink-0 mt-1" />
                           <div>
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground">#{issue.number}</span>
                                <h4 className="text-xs font-semibold line-clamp-2 group-hover:text-primary transition-colors text-white">{issue.title}</h4>
                             </div>
                             <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{issue.body?.slice(0, 100)}</p>
                           </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <div className="split-bottom flex flex-col bg-[#1e1e1e] relative">
         <div className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 p-4">
               <div className="space-y-4 max-w-2xl mx-auto pb-4">
                  {chatMessages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex gap-3",
                        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                        msg.role === 'user' ? "bg-primary text-primary-foreground" : 
                        msg.role === 'system' ? "bg-muted text-muted-foreground" : "bg-[#937AFF] text-white"
                      )}>
                        {msg.role === 'user' ? <Hash className="w-4 h-4" /> : 
                         msg.role === 'system' ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={cn(
                        "max-w-[85%] p-3 rounded-2xl text-[13px] shadow-sm whitespace-pre-wrap",
                        msg.role === 'user' ? "bg-primary text-white rounded-tr-none" : 
                        msg.role === 'system' ? "bg-muted/50 text-muted-foreground italic text-xs" : "bg-card border border-border rounded-tl-none text-blue-100/90"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isProcessing && (
                     <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-8 h-8 rounded-lg bg-[#937AFF] text-white flex items-center justify-center shrink-0">
                           <Cpu className="w-4 h-4 animate-spin" />
                        </div>
                        <div className="bg-card border border-border p-3 rounded-2xl rounded-tl-none shadow-sm flex flex-col gap-1">
                           <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                 <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                 <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                 <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                              </div>
                              <span className="text-[12px] text-primary font-medium">{processingStatus}</span>
                           </div>
                           <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                              <Clock className="w-3 h-3" />
                              <span>Elapsed: {elapsedSeconds}s (Est. 30-60s)</span>
                           </div>
                        </div>
                     </div>
                  )}
                  <div ref={chatEndRef} />
               </div>
            </ScrollArea>
         </div>

         <div className="p-4 border-t border-border bg-[#1e1e1e] pb-safe">
            <div className="relative group">
               <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={`Ask ${selectedModel.name}...`}
                  className="pr-12 bg-[#252525] border-transparent focus:border-primary/50 h-12 rounded-xl transition-all shadow-lg text-white"
               />
               <Button 
                  size="icon" 
                  disabled={!userInput.trim() || isProcessing}
                  onClick={sendMessage}
                  className="absolute right-1 top-1 w-10 h-10 rounded-lg bg-primary hover:bg-primary/90 transition-all group-active:scale-95 shadow-md"
               >
                 <Send className="w-4 h-4 text-white" />
               </Button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-4">
               <div className="flex items-center gap-1.5">
                  <Cpu className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-headline uppercase tracking-wider">{selectedModel.name}</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <Code2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-headline uppercase tracking-wider">Mobile Web Optimized</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
