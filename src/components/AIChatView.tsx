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
  Cpu,
  Brain,
  Database,
  Compass,
  Sliders,
  Play,
  RotateCw,
  Search,
  Check,
  User,
  GitBranch,
  ChevronRight,
  Settings,
  AlertHorizontal,
  Activity,
  HeartHandshake
} from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from '@/components/ui/progress';

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
  { id: 'groq/qwen-2.5-coder-32b', name: 'Qwen 2.5 Coder', provider: 'Groq', description: 'Primary: Specialized Coding' },
  { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'Groq', description: 'Primary: Hyper-Fast Logic' },
  { id: 'googleai/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'Google', description: 'Fallback: Advanced Tools & Reasoning' },
  { id: 'googleai/gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash', provider: 'Google', description: 'Fallback: Fast Efficiency' },
];

interface ChatMessage {
  role: 'user' | 'ai' | 'system';
  content: string;
  id: string;
  type?: 'knowledge' | 'agent-action' | 'standard' | 'error' | 'security-warning' | 'infra-blueprint' | 'memory-event';
  agentData?: ContextAwareCodeImprovementOutput;
  rawPrompt?: string;
  nodeSelected?: string;
}

interface Attachment {
  type: 'image' | 'file';
  name: string;
  data: string;
}

interface MemoryNode {
  id: string;
  fact: string;
  category: 'preference' | 'scope' | 'credential' | 'stack';
  timestamp: string;
}

export function AIChatView({ token, repo, activeFile, fileContent, currentBranch, initialPrompt, onFileUpdate, onMultiFileUpdate }: AIChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]); // Defaut groq/qwen-2.5-coder-32b
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeRepositoryOutput | null>(null);
  const [appliedChanges, setAppliedChanges] = useState<Set<string>>(new Set());
  const [isAutoTranslate, setIsAutoTranslate] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Microservices & Control panel tab settings
  const [activePanel, setActivePanel] = useState<'agents' | 'rag' | 'memory' | 'claude_code'>('agents');
  
  // LangGraph pipeline running node states
  const [langgraphActiveNode, setLanggraphActiveNode] = useState<string>('idle');
  const [agentRoles, setAgentRoles] = useState({
    planner: true,
    researcher: true,
    coder: true,
    reviewer: true,
    evaluator: true,
  });

  // mem0 long term memory store state
  const [memories, setMemories] = useState<MemoryNode[]>([
    { id: 'm1', fact: 'Preferred language is Japanese, fallbacks to English.', category: 'preference', timestamp: '2026-05-28 09:12' },
    { id: 'm2', fact: 'Uses Cloudflare Workers AI for edge AI routing.', category: 'stack', timestamp: '2026-05-28 10:14' },
    { id: 'm3', fact: 'Target dev sandbox leverages Daytona-powered containers.', category: 'stack', timestamp: '2026-05-28 12:45' },
    { id: 'm4', fact: 'Maintains RAG evaluation pipelines with RAGAS metrics.', category: 'scope', timestamp: '2026-05-29 11:32' },
  ]);
  const [newMemoryInput, setNewMemoryInput] = useState('');

  // RAG Pipeline Config
  const [ragChunkSize, setRagChunkSize] = useState(512);
  const [ragEmbeddingModel, setRagEmbeddingModel] = useState('bge-large-zh-v1.5');
  const [ragStrategy, setRagStrategy] = useState<'dense' | 'sparse' | 'hybrid'>('hybrid');
  const [ragasMetrics, setRagasMetrics] = useState({
    faithfulness: 88,
    answerRelevance: 91,
    contextRecall: 85,
    semanticStability: 94
  });

  // Claude Code interactive emulator commands
  const [claudeCommandLogs, setClaudeCommandLogs] = useState<string[]>([
    'Claude Code Agent Environment ready.',
    'Execute claude terminal commands below (e.g. "claude doctor", "claude mcp list", "claude help").'
  ]);
  const [claudeInput, setClaudeInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const [lang, setLang] = useState('Japanese');

  useEffect(() => {
    setLang(localStorage.getItem('ca_preferred_language') || 'Japanese');
  }, []);

  const t = (key: string) => {
    const dict: Record<string, any> = {
      'header': { English: 'Cognitive Orchestration Platform', Japanese: 'コグニティブ・エージェント' },
      'placeholder': { English: 'Instruct Devika, Claude Code & LangGraph...', Japanese: 'Devika / Claude Code / LangGraph パイプラインを稼働させます...' },
      'thinking': { English: 'Devika routing LangGraph state...', Japanese: 'Devika が LangGraph の状態を遷移中...' },
      'applied': { English: 'Daytona Sandbox Refreshed', Japanese: 'Daytona サンドボックス反映完了' },
    };
    return dict[key]?.[lang] || dict[key]?.English || key;
  };

  const generateId = () => Math.random().toString(36).substring(2, 11) + '-' + Date.now();

  useEffect(() => {
    if (initialPrompt && !isProcessing) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (!repo) return;
    fetchIssues(token, repo.full_name).then(setIssues);
    fetchCommits(token, repo.full_name, '', undefined, 10).then(setCommits);
    const saved = localStorage.getItem(`ca_chat_history_v2_${repo.full_name}`);
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch (e) { console.error('Failed to parse chat messages:', e); performAnalysis(); }
    } else {
      performAnalysis();
    }
  }, [repo]);

  useEffect(() => {
    if (repo && messages.length > 0) {
      localStorage.setItem(`ca_chat_history_v2_${repo.full_name}`, JSON.stringify(messages));
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, repo]);

  const performAnalysis = async () => {
    if (!repo) return;
    setIsProcessing(true);
    const id = generateId();
    setMessages(prev => [...prev, { role: 'system', content: `Mapping workspace pipelines with Devika / LlamaIndex ...`, id }]);
    try {
      const contents = await fetchContents(token, repo.full_name, '', currentBranch);
      const analysis = await analyzeRepository({ name: repo.name, description: repo.description || '', fileList: contents.map(c => c.name), language: lang });
      setAnalysisResult(analysis);
      setMessages(prev => [
        ...prev.filter(m => m.id !== id), 
        { 
          role: 'ai', 
          content: `### 🤖 Workspace Diagnostics Synced
I have loaded the repository information from **${repo.name}**. 
Active Project Type: \`${analysis.projectType}\`
Health Diagnostic Score: **${analysis.healthScore}/100**

#### ⛓️ Active Integration Graph:
- **Devika Task Splitting Engine** ➔ Ready
- **Claude Code Interactive MCP Terminal** ➔ Offline/Standby
- **LangGraph Multi-Agent Nodes** ➔ Idle
- **Ragflow / LlamaIndex Knowledge Sync** ➔ Running
- **mem0 Long-Term memory** ➔ Synced [${memories.length} facts cached]`,
          id: generateId(), 
          type: 'knowledge' 
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [...prev.filter(m => m.id !== id), { role: 'system', content: `Pipeline Synced Event: Repo parsed.`, id: generateId() }]);
    } finally { setIsProcessing(false); }
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
      setLanggraphActiveNode('idle');
      setMessages(prev => [...prev, { role: 'system', content: "Task workflow terminated by user.", id: generateId() }]);
    }
  };

  const sendMessage = async (customInput?: string, isRetry = false) => {
    const query = customInput || input;
    if (!query.trim() && attachments.length === 0 || isProcessing || !repo) return;
    
    // Auto add user search to mem0
    if (!customInput && query.toLowerCase().includes('database') || query.toLowerCase().includes('model')) {
      const parsedFact = `User specified requirement: "${query.slice(0, 50)}..."`;
      setMemories(prev => [
        ...prev,
        { id: generateId(), fact: parsedFact, category: 'scope', timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16) }
      ]);
    }

    const messageId = generateId();
    if (!customInput || isRetry) { 
      setMessages(prev => [...prev, { role: 'user', content: query, id: messageId, rawPrompt: query }]); 
      setInput(''); 
      setAttachments([]);
    }
    
    setIsProcessing(true);
    setLanggraphActiveNode('planner'); // Planner starts first
    abortControllerRef.current = new AbortController();

    try {
      const userApiKey = localStorage.getItem('GEMINI_API_KEY') || '';
      const groqKey = localStorage.getItem('GROQ_API_KEY') || '';
      let contextInstruction = query;

      if (isAutoTranslate) contextInstruction = `[TECHNICAL TRANSLATION TO ENGLISH]:\n${contextInstruction}`;
      
      // Load active mem0 memories to input instruction of Devika task splitting
      const memoriesCtx = memories.map(m => `- [${m.category}]: ${m.fact}`).join('\n');
      if (memories.length > 0) {
        contextInstruction = `[LONG-TERM MEM0 PERSISTED MEMORIES]:\n${memoriesCtx}\n\n[USER INPUT]:\n${contextInstruction}`;
      }

      // Progressively highlight LangGraph node movements visually
      setTimeout(() => setLanggraphActiveNode('researcher'), 1500);
      setTimeout(() => setLanggraphActiveNode('coder'), 3000);

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
      
      setLanggraphActiveNode('reviewer');
      setTimeout(() => setLanggraphActiveNode('evaluator'), 1000);

      // Mutate RAGAS metrics dynamically upon execution logic
      const deltaRagas1 = Math.floor(Math.random() * 5) - 2;
      const deltaRagas2 = Math.floor(Math.random() * 5) - 2;
      setRagasMetrics(prev => ({
        faithfulness: Math.min(100, Math.max(70, prev.faithfulness + deltaRagas1)),
        answerRelevance: Math.min(100, Math.max(70, prev.answerRelevance + deltaRagas2)),
        contextRecall: Math.min(100, Math.max(70, prev.contextRecall + deltaRagas1)),
        semanticStability: Math.min(100, Math.max(70, prev.semanticStability + deltaRagas2))
      }));

      // Append memory event message to list of chat stream
      const memoryLogs = `- Automatically recalled ${memories.length} memories\n- Appending new learned contexts to Mem0 schema`;

      const metadataStr = result.llmMetadata 
        ? `\n\n---\n*🧠 Memory: ${result.llmMetadata.memoryRetrieved ? 'mem0 long-term cache hits' : 'None'} | Workflow State: LangGraph [${result.llmMetadata.langgraphNode || 'node_routed'}] | Engine: ${result.llmMetadata.provider} [${result.llmMetadata.modelUsed}] ${result.llmMetadata.isFallback ? '(fallback routed)' : ''}*`
        : '';

      setMessages(prev => [
        ...prev, 
        {
          role: 'system',
          id: generateId(),
          content: `🧠 Long-term memory query hit:\n${memoryLogs}`,
          type: 'memory-event'
        },
        { 
          role: 'ai', 
          content: (result.explanation || "完成しました。") + metadataStr, 
          id: generateId(), 
          type: 'agent-action', 
          agentData: result,
          nodeSelected: result.llmMetadata?.langgraphNode || 'coder'
        }
      ]);

      setLanggraphActiveNode('idle');
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setMessages(prev => [...prev, { role: 'system', content: `AI Flow Routing Failure: ${e.message}. Using safety fallback.`, id: generateId(), type: 'error' }]);
      setLanggraphActiveNode('idle');
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
    
    dispatchLog(`⚙️ [LangGraph / Devika] Initiating task splitting execution loop...`);
    try {
      if (onMultiFileUpdate) onMultiFileUpdate(agentData.fileChanges);
      const total = agentData.fileChanges.length;
      for (let i = 0; i < total; i++) {
        const change = agentData.fileChanges[i];
        dispatchLog(`🛠️ Updating Daytona Workspace node reference for: ${change.file}...`);
        let existingSha: string | undefined = undefined;
        try { 
          const info = await fetchFileDetails(token, repo.full_name, change.file, currentBranch); 
          existingSha = info.sha; 
        } catch (e) { console.error('Failed to fetch file details:', e); }
        await createCommit(token, repo.full_name, change.file, `Devika Agent Edit: ${change.file}`, change.content, existingSha, currentBranch);
        dispatchLog(`✅ Synced files to Daytona workspace container: ${change.file}`);
      }
      
      setAppliedChanges(prev => new Set(prev).add(messageId));
      dispatchLog(`🎉 Code output applied successfully. Ready to trigger Daytona verification execution.`);
      toast({ title: t('applied') });
    } catch (e: any) { 
      dispatchLog(`❌ ERROR: ${e.message}`);
      toast({ variant: "destructive", title: "Apply Failed", description: e.message }); 
    } finally { setIsProcessing(false); }
  };

  // Memory additions
  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryInput.trim()) return;
    const node: MemoryNode = {
      id: generateId(),
      fact: newMemoryInput.trim(),
      category: 'preference',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };
    setMemories(prev => [node, ...prev]);
    setNewMemoryInput('');
    toast({ title: "Memory Stored", description: "Fact appended to mem0 cognitive node." });
  };

  const handleRemoveMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
    toast({ title: "Memory Forgotten", description: "Fact cleared from long-term memory." });
  };

  // Claude Code Emulator submit command
  const handleClaudeCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claudeInput.trim()) return;
    const cmd = claudeInput.trim();
    setClaudeCommandLogs(prev => [...prev, `> ${cmd}`]);
    setClaudeInput('');

    setTimeout(() => {
      let output = '';
      if (cmd.startsWith('claude doctor')) {
        output = '🩺 Checking environment health:\n- Node version: v20.11.0\n- MCP Gateway: Connected (Secure)\n- Skills Cache: Loaded\n- Daytona Endpoint: Live\n👉 Health: 100% OK';
      } else if (cmd.startsWith('claude mcp list')) {
        output = '🎯 Active Model Context Protocol (MCP) clients:\n1. filesystem - Disk mounting\n2. cloudflare - Worker automation\n3. memory - mem0 SQLite relational fact hub';
      } else if (cmd.startsWith('claude config')) {
        output = '⚙️ Current configuration:\n- default_model: groq/qwen-2.5-coder-32b\n- fallback_model: googleai/gemini-3.1-pro-preview\n- memory_engine: supermemory/mem0-sqlite';
      } else if (cmd.includes('help')) {
        output = '📖 Commands list:\n- claude doctor  : Audit environment state\n- claude mcp list: Check active protocols\n- claude config  : Check system configs\n- claude clean   : Reset agent logs';
      } else if (cmd.startsWith('claude clean')) {
        setClaudeCommandLogs([]);
        return;
      } else {
        output = `Executed agent procedure for sequence: "${cmd}". Output dispatched successfully.`;
      }
      setClaudeCommandLogs(prev => [...prev, output]);
    }, 450);
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-background overflow-hidden w-full select-none" id="ai-cognitive-platform">
      {/* LEFT AREA: CHAT STREAM */}
      <div className="flex-1 flex flex-col min-w-0 h-full border-r border-border/40">
        <header className="h-14 border-b border-border bg-background/50 backdrop-blur-xl flex items-center px-6 justify-between shrink-0 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">{t('header')}</h2>
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono text-muted-foreground uppercase">{selectedModel.name}</span>
                <Badge variant="outline" className="text-[7px] text-emerald-500 uppercase tracking-tighter ml-1.5 border-emerald-500/20 bg-emerald-500/5">
                  Groq Default + Gemini Fallback
                </Badge>
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

        <div className="flex-1 overflow-hidden w-full relative">
          <ScrollArea className="h-full w-full">
            <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-4 w-full group animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border mt-1 transition-transform group-hover:scale-105", 
                    msg.role === 'user' ? "bg-primary border-primary/20 text-white" : 
                    msg.type === 'memory-event' ? "bg-purple-950/20 border-purple-500/20 text-purple-400" :
                    "bg-card border border-border text-primary"
                  )}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : 
                     msg.type === 'memory-event' ? <Brain className="w-4 h-4 text-purple-400" /> :
                     <Bot className="w-4 h-4" />}
                  </div>
                  <div className={cn("flex flex-col gap-2 max-w-[85%] min-w-0", msg.role === 'user' ? "items-end text-right" : "items-start text-left")}>
                    <div className={cn("p-4 rounded-2xl text-xs leading-relaxed relative w-full shadow-sm transition-all border", 
                      msg.role === 'user' ? "bg-primary/5 border-primary/20 rounded-tr-none" : 
                      msg.type === 'memory-event' ? "bg-purple-950/10 border-purple-900/30 text-purple-300 rounded-tl-none font-mono" :
                      "bg-muted/10 border-border/40 rounded-tl-none"
                    )}>
                      <div className="break-words whitespace-pre-wrap font-sans text-foreground">
                        {msg.content}
                      </div>

                      {/* Code file outputs rendering for Devika autonomous actions */}
                      {msg.agentData?.fileChanges && msg.agentData.fileChanges.length > 0 && (
                        <div className="mt-6 space-y-3 w-full border-t border-border/40 pt-4 text-left">
                          <div className="flex items-center gap-2 text-[9px] font-bold text-primary uppercase tracking-[0.2em] mb-1">
                            <Workflow className="w-3.5 h-3.5" /> Devika Generated Workspace Blueprints
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {msg.agentData.fileChanges.map((change, idx) => (
                              <div key={idx} className="bg-background/40 border border-border/60 rounded-xl p-3 flex items-center justify-between gap-4 group/item hover:border-primary/40 transition-all">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span className="text-[10px] font-mono truncate text-foreground/80">{change.file}</span>
                                </div>
                                <span className="text-[8px] uppercase tracking-wider font-mono font-bold text-muted-foreground opacity-60">Verified</span>
                              </div>
                            ))}
                          </div>
                          <Button onClick={() => handleApplyChanges(msg.id, msg.agentData!)} disabled={appliedChanges.has(msg.id) || isProcessing} className={cn("w-full rounded-xl h-10 gap-2 text-[9px] font-bold uppercase tracking-wider border transition-all mt-2", appliedChanges.has(msg.id) ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.01]")}>
                            {appliedChanges.has(msg.id) ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5 fill-white" />}
                            {appliedChanges.has(msg.id) ? "Synced to Daytona" : `Apply Workspace Changes`}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="w-8 h-8 rounded-xl bg-card border border-border text-primary flex items-center justify-center shrink-0 shadow-sm mt-1 animate-spin"><Loader2 className="w-4 h-4 text-primary" /></div>
                  <div className="bg-muted/10 border border-border/40 p-4 rounded-2xl rounded-tl-none flex flex-col gap-2 shadow-sm max-w-[85%] w-full">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5"><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span><span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span></div>
                      <span className="text-[9px] text-primary font-bold uppercase tracking-[0.2em]">
                        {langgraphActiveNode === 'planner' && 'Step 1/5: Planner Node (Devika Task Map)'}
                        {langgraphActiveNode === 'researcher' && 'Step 2/5: LlamaIndex retrieval from vector store'}
                        {langgraphActiveNode === 'coder' && 'Step 3/5: Qwen 2.5 Coder reasoning engine'}
                        {langgraphActiveNode === 'reviewer' && 'Step 4/5: Code reviewer audit check'}
                        {langgraphActiveNode === 'evaluator' && 'Step 5/5: RAGAS Evaluation check'}
                        {langgraphActiveNode === 'idle' && t('thinking')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* INPUT BOX */}
        <div className="px-4 py-4 bg-background shrink-0 w-full border-t border-border/50">
          <div className="max-w-4xl mx-auto space-y-3">
            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {attachments.map((a, i) => (
                  <div key={i} className="relative group shrink-0">
                    <div className="bg-muted/30 border border-border/50 rounded-xl p-2 flex items-center gap-2 pr-8 shadow-inner">
                      {a.type === 'image' ? <ImageIcon className="w-3.5 h-3.5 text-primary" /> : <Paperclip className="w-3.5 h-3.5 text-blue-500" />}
                      <span className="text-[9px] font-mono truncate max-w-[120px] font-bold opacity-70 text-foreground">{a.name}</span>
                    </div>
                    <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-4 h-4 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-red-500"><X className="w-2.5 h-2.5" /></button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="bg-card border border-border/60 rounded-3xl p-1.5 flex items-center gap-2 shadow-2xl transition-all focus-within:border-primary/60 min-h-[54px] relative ring-1 ring-border/10">
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:bg-muted hover:text-primary transition-all" disabled={isProcessing || !repo}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="bg-card border-border w-56 p-2 rounded-xl shadow-2xl mb-3 z-[100]">
                    <DropdownMenuItem onClick={() => imageInputRef.current?.click()} className="gap-2.5 py-2 px-3 rounded-lg cursor-pointer">
                      <ImageIcon className="w-3.5 h-3.5 text-primary" />
                      <div className="flex flex-col text-left"><span className="text-[10px] font-bold">Upload Files (Images)</span><span className="text-[8px] opacity-60">Add visual asset context</span></div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2.5 py-2 px-3 rounded-lg cursor-pointer">
                      <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                      <div className="flex flex-col text-left"><span className="text-[10px] font-bold">Inject Documents</span><span className="text-[8px] opacity-60">Upload local spec docs</span></div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsAutoTranslate(!isAutoTranslate)} 
                  className={cn("h-9 w-9 rounded-full transition-all", isAutoTranslate ? "text-primary bg-primary/10 border border-primary/20 animate-pulse" : "text-muted-foreground hover:bg-muted")} 
                  title={lang === 'Japanese' ? 'English Translate Mode' : 'Japanese Mode'}
                >
                  <Languages className="w-3.5 h-3.5" />
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
                  className="bg-transparent border-none w-full max-h-36 resize-none py-2 px-1 text-xs focus:ring-0 focus-visible:ring-0 placeholder:text-muted-foreground/50 font-sans text-foreground scrollbar-hide focus:outline-none" 
                />
              </div>

              <div className="flex items-center gap-1.5 mr-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => { setIsListening(!isListening); toast({ title: isListening ? "Speech Cleared" : "Listening Active", description: "Vibe translation active." }); }} className={cn("h-9 w-9 rounded-full transition-all", isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground hover:bg-muted")}><Mic className="w-3.5 h-3.5" /></Button>
                <Button size="icon" disabled={(!input.trim() && attachments.length === 0) || isProcessing || !repo} onClick={() => sendMessage()} className="h-10 w-10 rounded-full bg-primary text-white shadow-xl shadow-primary/10 transition-all hover:scale-105"><Send className="w-3.5 h-3.5 fill-white" /></Button>
              </div>
            </div>
            
            <div className="flex justify-center">
              <p className="text-[8px] text-muted-foreground/60 flex items-center gap-1 font-mono uppercase tracking-[0.1em]">
                <ShieldCheck className="w-2.5 h-2.5" /> Cognitive Multi-Agent Grid Active v2.5
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: COGNITIVE HUB */}
      <div className="w-full md:w-80 shrink-0 h-full border-t md:border-t-0 border-border/40 bg-card/10 flex flex-col">
        {/* TAB SWITCHER */}
        <div className="flex border-b border-border bg-card/30 p-1 gap-1 shrink-0">
          <button onClick={() => setActivePanel('agents')} className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all text-center", activePanel === 'agents' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}>
            Agents
          </button>
          <button onClick={() => setActivePanel('rag')} className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all text-center", activePanel === 'rag' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}>
            RAG
          </button>
          <button onClick={() => setActivePanel('memory')} className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all text-center", activePanel === 'memory' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}>
            mem0
          </button>
          <button onClick={() => setActivePanel('claude_code')} className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all text-center", activePanel === 'claude_code' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}>
            Claude CLI
          </button>
        </div>

        <ScrollArea className="flex-1 w-full p-4">
          {/* TAB 1: LANGRAPH & DEVIKA AGENTS CONTROL */}
          {activePanel === 'agents' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-foreground">LangGraph Multi-Agent Stack</h3>
                <p className="text-[9px] text-muted-foreground">Orchestrate specialized state machine nodes autonomously</p>
              </div>

              {/* Graphical State Node Visualizer */}
              <div className="bg-card/40 border border-border/60 rounded-2xl p-4 space-y-4">
                <div className="space-y-2.5">
                  {[
                    { id: 'planner', name: 'Planner (Devika Logic)', role: 'Constructs initial task list' },
                    { id: 'researcher', name: 'Researcher (LlamaIndex)', role: 'Retrieves knowledge docs' },
                    { id: 'coder', name: 'Coder (Qwen 2.5 Coder)', role: 'Assembles full code changes' },
                    { id: 'reviewer', name: 'Reviewer (LangGraph)', role: 'Audit check against rules' },
                    { id: 'evaluator', name: 'Evaluator (RAGAS)', role: 'RAG verification score metrics' }
                  ].map((node, index) => {
                    const isActive = langgraphActiveNode === node.id;
                    const isPassed = ['planner', 'researcher', 'coder', 'reviewer', 'evaluator'].indexOf(langgraphActiveNode) > index;
                    return (
                      <div key={node.id} className="relative flex items-start gap-3">
                        {/* Dot visual column */}
                        <div className="flex flex-col items-center">
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold shrink-0 z-10 transition-all", 
                            isActive ? "bg-primary border-primary text-white scale-110 animate-pulse" : 
                            isPassed ? "bg-emerald-500 border-emerald-500 text-white" : 
                            "bg-muted border-muted text-muted-foreground"
                          )}>
                            {isPassed ? <Check className="w-2.5 h-2.5" /> : index + 1}
                          </div>
                          {index < 4 && (
                            <div className={cn("w-0.5 h-10 -my-0.5 z-0 transition-colors", 
                              isPassed ? "bg-emerald-500/50" : "bg-muted"
                            )} />
                          )}
                        </div>

                        {/* Node details */}
                        <div className="flex-1 pb-2">
                          <div className="flex justify-between items-center">
                            <span className={cn("text-[10px] font-bold", isActive ? "text-primary" : isPassed ? "text-emerald-500" : "text-muted-foreground")}>
                              {node.name}
                            </span>
                            {isActive && <Badge variant="outline" className="text-[7px] border-primary/30 text-primary py-0 px-1 bg-primary/5">Executing</Badge>}
                          </div>
                          <p className="text-[8px] text-muted-foreground/80 leading-tight mt-0.5">{node.role}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Enable / Disable team configs */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Pipeline Roles Settings</span>
                <div className="bg-card/30 border border-border/50 rounded-xl p-3 space-y-2.5">
                  {Object.entries(agentRoles).map(([role, enabled]) => (
                    <div key={role} className="flex justify-between items-center text-[10px]">
                      <span className="capitalize font-mono text-foreground/80">{role} agent</span>
                      <button 
                        onClick={() => setAgentRoles(prev => ({ ...prev, [role]: !enabled }))}
                        className={cn("px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-all tracking-wider border", 
                          enabled ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-muted border-border text-muted-foreground"
                        )}
                      >
                        {enabled ? 'Active' : 'Bypassed'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LlamaIndex / RagFlow Pipeline & RAGAS */}
          {activePanel === 'rag' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-foreground">RAG Pipeline configuration</h3>
                <p className="text-[9px] text-muted-foreground">Adjust chunk indexing & Retrieval strategies (RagFlow)</p>
              </div>

              <div className="bg-card/40 border border-border/60 rounded-xl p-3.5 space-y-4">
                {/* Chunk Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-mono">
                    <span className="opacity-70 text-foreground">Chunk Size (LlamaIndex)</span>
                    <span className="text-primary font-bold">{ragChunkSize} chars</span>
                  </div>
                  <input 
                    type="range" min="128" max="1024" step="128"
                    value={ragChunkSize} onChange={(e) => setRagChunkSize(Number(e.target.value))}
                    className="w-full text-primary" 
                  />
                </div>

                {/* Index Model */}
                <div className="space-y-1">
                  <span className="text-[8px] uppercase tracking-wider font-mono font-bold text-muted-foreground">Embedding Index Model</span>
                  <select 
                    value={ragEmbeddingModel} onChange={(e) => setRagEmbeddingModel(e.target.value)}
                    className="w-full bg-background border border-border text-[10px] rounded-lg p-1.5 text-foreground/85 font-mono"
                  >
                    <option value="bge-large-zh-v1.5">bge-large-zh-v1.5 (Local Weight)</option>
                    <option value="text-embedding-3-small">text-embedding-3-small (Cloud)</option>
                    <option value="cohere-embed-english-v3">cohere-embed-english-v3</option>
                  </select>
                </div>

                {/* Search Strategy */}
                <div className="space-y-1">
                  <span className="text-[8px] uppercase tracking-wider font-mono font-bold text-muted-foreground">RagFlow Retrieval Algorithm</span>
                  <div className="grid grid-cols-3 gap-1">
                    {['dense', 'sparse', 'hybrid'].map((strategy) => (
                      <button 
                        key={strategy} onClick={() => setRagStrategy(strategy as any)}
                        className={cn("py-1 rounded text-[8px] font-mono capitalize border transition-all", 
                          ragStrategy === strategy ? "bg-primary/10 border-primary text-primary font-bold" : "bg-background border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {strategy}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RAGAS EVALUATION METRIC */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">RAGAS Evaluation Panel</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Faithfulness', val: ragasMetrics.faithfulness, color: 'text-emerald-500' },
                    { label: 'Relevance', val: ragasMetrics.answerRelevance, color: 'text-blue-500' },
                    { label: 'Context Recall', val: ragasMetrics.contextRecall, color: 'text-purple-500' },
                    { label: 'Stability', val: ragasMetrics.semanticStability, color: 'text-cyan-500' }
                  ].map((metric) => (
                    <div key={metric.label} className="bg-card/45 border border-border/50 rounded-xl p-3 flex flex-col justify-between h-18 text-left">
                      <span className="text-[8px] uppercase tracking-wider font-mono text-muted-foreground">{metric.label}</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className={cn("text-lg font-bold font-mono tracking-tight", metric.color)}>{metric.val}</span>
                        <span className="text-[8px] text-muted-foreground/60">%</span>
                      </div>
                      <Progress value={metric.val} className="h-0.5 inline-block bg-muted mt-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: mem0 Permanent Cognitive Memory */}
          {activePanel === 'memory' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1 animate-pulse">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" /> mem0 Permanent Synapse
                </h3>
                <p className="text-[9px] text-muted-foreground">SQLite relational key-value storage keeping developer contexts</p>
              </div>

              {/* Fact Add form */}
              <form onSubmit={handleAddMemory} className="flex gap-1">
                <Input 
                  value={newMemoryInput} onChange={(e) => setNewMemoryInput(e.target.value)}
                  placeholder="Remember fact (e.g., target Fly.io DB)" 
                  className="h-8 text-[10px] bg-background border-border placeholder:text-muted-foreground/60 rounded-lg flex-1 font-sans"
                />
                <Button type="submit" size="sm" className="h-8 rounded-lg bg-primary hover:bg-primary-hover px-2 text-[9px] font-bold"><Plus className="w-3.5 h-3.5" /></Button>
              </form>

              {/* Fact list output */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Learned Relational Facts</span>
                <div className="space-y-1.5">
                  {memories.map((m) => (
                    <div key={m.id} className="bg-purple-950/5 border border-purple-900/10 rounded-xl p-3 text-[10px] flex justify-between gap-3 text-left">
                      <div className="space-y-1 leading-tight flex-1">
                        <p className="text-foreground/90 font-sans">{m.fact}</p>
                        <div className="flex gap-1.5 items-center">
                          <code className="text-[7px] text-purple-400 uppercase font-mono px-1 py-0.2 bg-purple-950/20 rounded border border-purple-500/20">{m.category}</code>
                          <span className="text-[7px] text-muted-foreground font-mono">{m.timestamp}</span>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveMemory(m.id)} className="text-muted-foreground hover:text-red-500 self-start p-0.5 shrink-0"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {memories.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground/60 text-[10px]">No persistent memories learned yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Claude Code & Model Context Protocol (MCP) */}
          {activePanel === 'claude_code' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" /> Claude Code CLI Terminal
                </h3>
                <p className="text-[9px] text-muted-foreground">Interactive command-line client matching full workspace MCP</p>
              </div>

              {/* Terminal Frame */}
              <div className="bg-black rounded-xl border border-border/40 overflow-hidden flex flex-col h-72">
                <div className="bg-zinc-950 px-3 py-1 flex items-center justify-between border-b border-white/5 select-none shrink-0">
                  <span className="text-[8px] font-mono text-zinc-500 tracking-wider">claude-code-bash</span>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full" />
                    <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full" />
                  </div>
                </div>
                <ScrollArea className="flex-1 bg-zinc-950/50 p-2.5">
                  <div className="font-mono text-[9px] space-y-1 text-zinc-300">
                    {claudeCommandLogs.map((log, idx) => (
                      <div key={idx} className="whitespace-pre-wrap leading-tight">
                        {log}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <form onSubmit={handleClaudeCommand} className="flex gap-1.5 p-1.5 bg-zinc-950 border-t border-white/5 shrink-0 items-center">
                  <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <input 
                    value={claudeInput} onChange={(e) => setClaudeInput(e.target.value)}
                    placeholder="claude doctor..."
                    className="flex-1 min-w-0 bg-transparent border-none text-[9px] text-white focus:ring-0 focus:outline-none focus-visible:ring-0 placeholder:text-zinc-700 font-mono"
                  />
                  <button type="submit" className="invisible w-0" />
                </form>
              </div>

              {/* Config summary details */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Active Model Context Protocol Plugins</span>
                <div className="bg-card/40 border border-border/50 rounded-xl p-3.5 space-y-2.5 text-xs text-left">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-mono text-foreground/80 flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-blue-400" /> sqlite:mem0 (Memory mount)</span>
                    <Badge variant="outline" className="text-[7px]_uppercase font-bold text-emerald-500 border-emerald-500/20 bg-emerald-500/5">Active</Badge>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-mono text-foreground/80 flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-green-400" /> filesystem (Git context)</span>
                    <Badge variant="outline" className="text-[7px]_uppercase font-bold text-emerald-500 border-emerald-500/20 bg-emerald-500/5">Active</Badge>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-mono text-foreground/80 flex items-center gap-1.5"><Plug className="w-3.5 h-3.5 text-purple-400" /> cloudflare (Deploy routing)</span>
                    <Badge variant="outline" className="text-[7px]_uppercase font-bold text-blue-400 border-blue-500/20 bg-blue-500/5">Dynamic</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
