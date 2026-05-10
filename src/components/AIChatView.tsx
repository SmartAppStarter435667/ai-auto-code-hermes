"use client"

import React, { useState, useRef, useEffect } from 'react';
import { 
  GitHubRepo, 
  GitHubContent, 
  fetchIssues, 
  fetchContents,
  fetchCommits,
  createCommit,
  fetchFileContent as fetchFileDetails
} from '@/app/lib/github';
import { contextAwareCodeImprovement, ContextAwareCodeImprovementOutput } from "@/ai/flows/context-aware-code-improvement";
import { analyzeRepository, AnalyzeRepositoryOutput } from "@/ai/flows/analyze-repository";
import { 
  Send, 
  Bot, 
  Hash, 
  Sparkles, 
  ChevronDown, 
  CheckCircle2, 
  Plus, 
  Workflow, 
  Loader2, 
  Image as ImageIcon, 
  Paperclip, 
  X, 
  RotateCcw, 
  Copy, 
  Zap, 
  Terminal, 
  FileCode,
  Languages,
  Edit2,
  Mic,
  Square,
  Plug,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface AIChatViewProps {
  token: string;
  repo: GitHubRepo | null;
  activeFile: GitHubContent | null;
  fileContent: string;
  currentBranch?: string;
  initialPrompt?: string;
  onFileUpdate: (content: string) => void;
  onMultiFileUpdate?: (changes: { file: string, content: string }[]) => void;
}

const MODELS = [
  { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq', description: 'Primary: Hyper-Fast Logic' },
  { id: 'groq/qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder', provider: 'Groq', description: 'Primary: Specialized Coding' },
  { id: 'googleai/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'Google', description: 'Advanced Tools & CrewAI Bridge' },
  { id: 'googleai/gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash', provider: 'Google', description: 'Fallback: Efficiency' },
];

interface ChatMessage {
  role: 'user' | 'ai' | 'system';
  content: string;
  id: string;
  type?: 'knowledge' | 'agent-action' | 'standard' | 'error' | 'security-warning' | 'infra-blueprint';
  agentData?: ContextAwareCodeImprovementOutput;
  rawPrompt?: string;
}

interface Attachment {
  type: 'image' | 'file';
  name: string;
  data: string;
}

export function AIChatView({ token, repo, activeFile, fileContent, currentBranch, initialPrompt, onFileUpdate, onMultiFileUpdate }: AIChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeRepositoryOutput | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<Set<string>>(new Set());
  const [isAutoTranslate, setIsAutoTranslate] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeMcpContext, setActiveMcpContext] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const [lang, setLang] = useState('Japanese');

  useEffect(() => {
    setLang(localStorage.getItem('ca_preferred_language') || 'Japanese');
    const mcpList: string[] = [];
    const keys = ['cloudflare', 'figma', 'notion', 'google_workspace', 'ms365', 'claude', 'chatgpt'];
    keys.forEach(k => {
      if (localStorage.getItem(`mcp_${k}_token`) || localStorage.getItem(`mcp_${k}_key`)) {
        mcpList.push(k.charAt(0).toUpperCase() + k.slice(1));
      }
    });
    setActiveMcpContext(mcpList);
  }, []);

  const t = (key: string) => {
    const dict: Record<string, any> = {
      'header': { English: 'Hybrid Orchestration', Japanese: 'ハイブリッド・エージェント' },
      'placeholder': { English: 'How can I assist your workflow today?', Japanese: 'どのようにお手伝いしましょうか？' },
      'thinking': { English: 'Agent Reasoning...', Japanese: 'AI推論中...' },
      'delegating': { English: 'Offloading to CrewAI...', Japanese: 'CrewAIにタスクを委譲中...' },
      'applied': { English: 'Changes Applied', Japanese: '変更適用完了' },
    };
    return dict[key]?.[lang] || dict[key]?.English || key;
  };

  const generateId = () => Math.random().toString(36).substring(2, 11) + '-' + Date.now();

  useEffect(() => {
    if (initialPrompt && !isProcessing) sendMessage(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    if (!repo) return;
    fetchIssues(token, repo.full_name).then(setIssues);
    fetchCommits(token, repo.full_name, '', undefined, 10).then(setCommits);
    const saved = localStorage.getItem(`ca_chat_history_${repo.full_name}`);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch (e) { console.error('Failed to parse chat messages:', e); performAnalysis(); }
    } else {
      performAnalysis();
    }
  }, [repo]);

  useEffect(() => {
    if (repo && messages.length > 0) localStorage.setItem(`ca_chat_history_${repo.full_name}`, JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, repo]);

  const performAnalysis = async () => {
    if (!repo) return;
    setIsProcessing(true);
    const id = generateId();
    setMessages(prev => [...prev, { role: 'system', content: `Mapping repository structure & deep audit...`, id }]);
    try {
      const contents = await fetchContents(token, repo.full_name, '', currentBranch);
      const analysis = await analyzeRepository({ name: repo.name, description: repo.description || '', fileList: contents.map(c => c.name), language: lang });
      setAnalysisResult(analysis);
      setMessages(prev => [...prev.filter(m => m.id !== id), { 
        role: 'ai', 
        content: `### 🤖 Repository Analysis Complete\n\nI have identified this as a **${analysis.projectType}** project.\n\n${analysis.analysis}\n\n**Health Score: ${analysis.healthScore}/100**`, 
        id: generateId(), 
        type: 'knowledge' 
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev.filter(m => m.id !== id), { role: 'system', content: `Error: ${err.message}`, id: generateId() }]);
    } finally { setIsProcessing(false); }
  };

  const toggleVoiceInput = () => {
    setIsListening(!isListening);
    toast({ title: isListening ? "Mic Off" : "Voice Active" });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as string;
      setAttachments(prev => [...prev, { type, name: file.name, data }]);
    };
    if (type === 'image') reader.readAsDataURL(file);
    else reader.readAsText(file);
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setMessages(prev => [...prev, { role: 'system', content: "Generation stopped.", id: generateId() }]);
    }
  };

  const sendMessage = async (customInput?: string, isRetry = false) => {
    const query = customInput || input;
    if (!query.trim() && attachments.length === 0 || isProcessing || !repo) return;
    
    const messageId = generateId();
    if (!customInput || isRetry) { 
      setMessages(prev => [...prev, { role: 'user', content: query, id: messageId, rawPrompt: query }]); 
      setInput(''); 
      setAttachments([]);
    }
    
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    try {
      const userApiKey = localStorage.getItem('GEMINI_API_KEY') || '';
      const groqKey = localStorage.getItem('GROQ_API_KEY') || '';
      let contextInstruction = query;

      if (isAutoTranslate) contextInstruction = `[TECHNICAL TRANSLATION TO ENGLISH]:\n${contextInstruction}`;
      if (activeMcpContext.length > 0) {
        contextInstruction = `[MCP ACTIVE CONTEXT: ${activeMcpContext.join(', ')}]\n${contextInstruction}`;
      }

      const result = await contextAwareCodeImprovement({
        instruction: contextInstruction,
        code: activeFile ? fileContent : '',
        githubIssues: issues.map(i => ({ title: i.title, body: i.body, url: i.url })),
        recentCommits: commits.map(c => ({ sha: c.sha.substring(0, 7), message: c.commit.message, date: c.commit.author.date })),
        architectureContext: analysisResult?.architectureMap,
        modelId: selectedModel.id,
        language: lang,
        userApiKey: userApiKey,
        groqKey: groqKey
      });

      if (abortControllerRef.current.signal.aborted) return;
      
      const metadataStr = result.llmMetadata 
        ? `\n\n--- \n*Engine: ${result.llmMetadata.provider} (${result.llmMetadata.modelUsed}) ${result.llmMetadata.isFallback ? ' (Fallback)' : ''} ${result.llmMetadata.toolUsed ? ' (CrewAI Active)' : ''}*`
        : '';

      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: (result.explanation || "分析が完了しました。") + metadataStr, 
        id: generateId(), 
        type: 'agent-action', 
        agentData: result 
      }]);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setMessages(prev => [...prev, { role: 'system', content: `AI Error: ${e.message}`, id: generateId(), type: 'error' }]);
    } finally { 
      setIsProcessing(false); 
      abortControllerRef.current = null;
    }
  };

  const handleApplyChanges = async (messageId: string, agentData: ContextAwareCodeImprovementOutput) => {
    if (!repo || !agentData.fileChanges || agentData.fileChanges.length === 0) return;
    setIsProcessing(true);
    window.dispatchEvent(new CustomEvent('show-upload-console'));
    
    const dispatchLog = (msg: string) => {
      const currentLogs = JSON.parse(localStorage.getItem('cursor_app_upload_logs') || '[]');
      const newLogs = [...currentLogs, `[${new Date().toLocaleTimeString()}] ${msg}`];
      localStorage.setItem('cursor_app_upload_logs', JSON.stringify(newLogs));
      window.dispatchEvent(new CustomEvent('update-console-logs'));
    };
    
    dispatchLog(`🚀 Initializing Autonomous Orchestration Engine...`);
    try {
      if (onMultiFileUpdate) onMultiFileUpdate(agentData.fileChanges);
      const total = agentData.fileChanges.length;
      for (let i = 0; i < total; i++) {
        const change = agentData.fileChanges[i];
        dispatchLog(`⏳ [${i + 1}/${total}] Committing: ${change.file}...`);
        let existingSha: string | undefined = undefined;
        try { 
          const info = await fetchFileDetails(token, repo.full_name, change.file, currentBranch); 
          existingSha = info.sha; 
        } catch (e) { console.error('Failed to fetch file details:', e); }
        await createCommit(token, repo.full_name, change.file, `AI Autonomous Action: ${change.file}`, change.content, existingSha, currentBranch);
        dispatchLog(`✅ Synced: ${change.file}`);
      }
      
      setAppliedChanges(prev => new Set(prev).add(messageId));
      dispatchLog(`✅ Orchestration Sequence Complete.`);
      toast({ title: t('applied') });
    } catch (e: any) { 
      dispatchLog(`❌ ERROR: ${e.message}`);
      toast({ variant: "destructive", title: "Apply Failed", description: e.message }); 
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden w-full">
      <header className="h-14 border-b border-border bg-background/50 backdrop-blur-xl flex items-center px-6 justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">{t('header')}</h2>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono text-muted-foreground uppercase">{selectedModel.name}</span>
              {activeMcpContext.length > 0 && (
                <div className="flex items-center gap-1 text-[8px] font-bold text-purple-400 uppercase tracking-tighter ml-2">
                  <Plug className="w-2.5 h-2.5" /> MCP ACTIVE: {activeMcpContext.length}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isProcessing && (
            <Button variant="ghost" size="sm" onClick={handleStopGenerating} className="h-8 text-[9px] text-destructive hover:bg-destructive/10 rounded-lg gap-1.5 px-3 border border-destructive/20">
              <Square className="w-2.5 h-2.5 fill-destructive" /> Stop
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-[9px] font-mono gap-1 rounded-lg border-border/50 bg-card/50">
                {selectedModel.name} <ChevronDown className="w-2.5 h-2.5 opacity-40" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border w-56 p-2 rounded-xl shadow-2xl z-[100]">
              {MODELS.map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => setSelectedModel(m)} className="text-[11px] flex flex-col items-start py-2 px-3 rounded-lg cursor-pointer">
                  <div className="flex justify-between items-center w-full mb-0.5">
                    <span className={cn("font-bold", selectedModel.id === m.id && "text-primary")}>{m.name}</span>
                    <span className="text-[7px] opacity-40 uppercase font-mono tracking-widest">{m.provider}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground leading-tight">{m.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 overflow-hidden w-full">
        <ScrollArea className="h-full w-full">
          <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-6 w-full group", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border-2 mt-1 transition-transform group-hover:scale-105", msg.role === 'user' ? "bg-primary border-primary/20 text-white" : "bg-card border border-border text-primary")}>
                  {msg.role === 'user' ? <Hash className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={cn("flex flex-col gap-3 max-w-[85%] min-w-0", msg.role === 'user' ? "items-end text-right" : "items-start text-left")}>
                  <div className={cn("p-5 rounded-3xl text-sm leading-relaxed relative w-full shadow-sm transition-all", msg.role === 'user' ? "bg-primary/5 border border-primary/20 rounded-tr-none" : "bg-muted/10 border border-border/40 rounded-tl-none")}>
                    <div className="prose prose-sm prose-invert max-w-none break-words whitespace-pre-wrap font-body text-foreground">
                      {msg.content}
                    </div>
                    {msg.agentData?.fileChanges && msg.agentData.fileChanges.length > 0 && (
                      <div className="mt-8 space-y-4 w-full border-t border-border/40 pt-8">
                        <div className="flex items-center gap-2 text-[9px] font-bold text-primary uppercase tracking-[0.2em] mb-2"><Workflow className="w-3.5 h-3.5" /> Generative Blueprints</div>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.agentData.fileChanges.map((change, idx) => (
                            <div key={idx} className="bg-background/40 border border-border/60 rounded-xl p-3 flex items-center justify-between gap-4 group/item hover:border-primary/40 transition-all">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                                <span className="text-[11px] font-mono truncate text-foreground/80">{change.file}</span>
                              </div>
                              <Badge variant="outline" className="text-[7px] uppercase opacity-40">Blueprint</Badge>
                            </div>
                          ))}
                        </div>
                        <Button onClick={() => handleApplyChanges(msg.id, msg.agentData!)} disabled={appliedChanges.has(msg.id) || isProcessing} className={cn("w-full rounded-2xl h-12 gap-2 text-[10px] font-bold uppercase tracking-wider", appliedChanges.has(msg.id) ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-primary text-white shadow-lg")}>
                          {appliedChanges.has(msg.id) ? <CheckCircle2 className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-white" />}
                          {appliedChanges.has(msg.id) ? "Synchronized" : `Autonomous Apply`}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className={cn("flex gap-1 opacity-0 group-hover:opacity-100 transition-all px-1", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                    <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(msg.content)} className="h-7 w-7 text-muted-foreground hover:text-primary"><Copy className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => sendMessage(msg.rawPrompt || msg.content, true)} className="h-7 w-7 text-muted-foreground hover:text-primary"><RotateCcw className="w-3.5 h-3.5" /></Button>
                    {msg.role === 'user' && <Button variant="ghost" size="icon" onClick={() => setInput(msg.content)} className="h-7 w-7 text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></Button>}
                  </div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="w-8 h-8 rounded-xl bg-card border border-border text-primary flex items-center justify-center shrink-0 shadow-sm mt-1 group-hover:scale-105"><Sparkles className="w-4 h-4 animate-pulse text-primary" /></div>
                <div className="bg-muted/10 border border-border/40 p-5 rounded-3xl rounded-tl-none flex flex-col gap-3 shadow-sm max-w-[85%] w-full">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5"><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span></div>
                    <span className="text-[10px] text-primary font-bold uppercase tracking-[0.2em]">
                      {selectedModel.id === 'googleai/gemini-3.1-pro-preview' ? t('delegating') : t('thinking')}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="px-4 py-6 bg-background shrink-0 w-full border-t border-border/50">
        <div className="max-w-4xl mx-auto space-y-4">
          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {attachments.map((a, i) => (
                <div key={i} className="relative group shrink-0">
                  <div className="bg-muted/30 border border-border/50 rounded-2xl p-2 flex items-center gap-2 pr-8 shadow-inner">
                    {a.type === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-primary" /> : <Paperclip className="w-3.5 h-3.5 text-blue-500" />}
                    <span className="text-[9px] font-mono truncate max-w-[120px] font-bold opacity-70 text-foreground">{a.name}</span>
                  </div>
                  <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-5 h-5 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
          
          <div className="bg-card border border-border/60 rounded-[2.5rem] p-2 flex items-center gap-2 shadow-2xl transition-all focus-within:border-primary/60 min-h-[64px] relative ring-1 ring-border/20">
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full text-muted-foreground hover:bg-muted hover:text-primary transition-all" disabled={isProcessing || !repo}>
                    <Plus className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="bg-card border-border w-64 p-2 rounded-2xl shadow-2xl mb-4 z-[100]">
                  <DropdownMenuItem onClick={() => imageInputRef.current?.click()} className="gap-3 py-3 rounded-xl cursor-pointer">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    <div className="flex flex-col text-left"><span className="text-[11px] font-bold">Analyze UI/Designs</span><span className="text-[9px] opacity-60">Visual multimodal context</span></div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-3 py-3 rounded-xl cursor-pointer">
                    <Paperclip className="w-4 h-4 text-blue-500" />
                    <div className="flex flex-col text-left"><span className="text-[11px] font-bold">Inject Documents</span><span className="text-[9px] opacity-60">Local file reference</span></div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedModel(MODELS.find(m => m.id === 'googleai/gemini-3.1-pro-preview')!)} className="gap-3 py-3 rounded-xl cursor-pointer">
                    <Cpu className="w-4 h-4 text-purple-500" />
                    <div className="flex flex-col text-left"><span className="text-[11px] font-bold">Delegate to Crew</span><span className="text-[9px] opacity-60">Agentic Offloading</span></div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsAutoTranslate(!isAutoTranslate)} 
                className={cn("h-10 w-10 rounded-full transition-all", isAutoTranslate ? "text-primary bg-primary/10 border border-primary/20 animate-pulse" : "text-muted-foreground hover:bg-muted")} 
                title={lang === 'Japanese' ? '英語翻訳モード' : 'English Mode'}
              >
                <Languages className="w-4 h-4" />
              </Button>
            </div>

            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />
            <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />

            <div className="flex-1 min-w-0">
              <textarea 
                value={input} 
                rows={1}
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={t('placeholder')} 
                className="bg-transparent border-none w-full max-h-48 resize-none py-3 px-2 text-sm focus:ring-0 focus-visible:ring-0 placeholder:text-muted-foreground/50 font-body text-foreground scrollbar-hide" 
              />
            </div>

            <div className="flex items-center gap-2 mr-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={toggleVoiceInput} className={cn("h-10 w-10 rounded-full transition-all", isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground hover:bg-muted")}><Mic className="w-4 h-4" /></Button>
              <Button size="icon" disabled={(!input.trim() && attachments.length === 0) || isProcessing || !repo} onClick={() => sendMessage()} className="h-11 w-11 rounded-full bg-primary text-white shadow-xl shadow-primary/20 transition-all active:scale-95 hover:scale-105"><Send className="w-4 h-4 fill-white" /></Button>
            </div>
          </div>
          
          <div className="flex justify-center">
            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5 uppercase tracking-widest font-bold">
              <ShieldCheck className="w-3 h-3" /> Agentic Offloading Protocol v3.1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
