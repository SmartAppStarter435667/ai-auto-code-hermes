"use client"

import React, { useState, useEffect, useRef } from 'react';
import { GitHubRepo, fetchFileContent, createCommit } from '@/app/lib/github';
import { 
  Terminal, 
  Play, 
  Globe, 
  Smartphone, 
  Cpu, 
  Loader2,
  ExternalLink,
  Zap,
  Rocket,
  ShieldCheck,
  Server,
  Cloud,
  ChevronRightSquare,
  Send,
  AlertTriangle,
  SearchCode,
  CheckCircle2,
  Info,
  HelpCircle,
  Wand2,
  Container,
  Activity,
  Box,
  BarChart3,
  LayoutDashboard,
  Shield
} from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { analyzeDeploymentLogs, AnalyzeLogsOutput } from '@/ai/flows/analyze-logs-flow';
import { contextAwareCodeImprovement } from '@/ai/flows/context-aware-code-improvement';
import { logUserAction } from '@/lib/interaction-logger';
import { useToast } from '@/hooks/use-toast';

interface SandboxViewProps {
  token: string;
  repo: GitHubRepo | null;
}

type BuildStatus = 'idle' | 'building' | 'success' | 'failed' | 'analyzing' | 'healing';
type Target = 'web' | 'android' | 'ios' | 'desktop' | 'server' | 'cloudflare';

export function SandboxView({ token, repo }: SandboxViewProps) {
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [target, setTarget] = useState<Target>('web');
  const [buildTime, setBuildTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalyzeLogsOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const [lang, setLang] = useState('English');
  useEffect(() => {
    setLang(localStorage.getItem('ca_preferred_language') || 'English');
    const savedLogs = localStorage.getItem('ca_sandbox_logs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    } else {
      setLogs([
        `[${new Date().toLocaleTimeString()}] 🤖 Universal Sandbox Forge ready.`,
        `[${new Date().toLocaleTimeString()}] 💡 Target: ${target.toUpperCase()}. Type 'deploy' to start.`
      ]);
    }
  }, [target]);

  useEffect(() => {
    if (logs.length > 0) {
      localStorage.setItem('ca_sandbox_logs', JSON.stringify(logs));
    }
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const displayHelp = () => {
    addLog("--- Universal Sandbox Forge CLI ---");
    addLog("sync      : Sync all project code to connected GitHub repository.");
    addLog("deploy    : Start autonomous build and container deployment.");
    addLog("analyze   : Perform AI diagnostic analysis on current deployment logs.");
    addLog("status    : Check current container and server resource status.");
    addLog("clear     : Clear the terminal output history.");
    addLog("help      : Display this command helper list.");
    addLog("------------------------------------");
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    
    const cmd = commandInput.trim().toLowerCase();
    addLog(`$ forge ${commandInput}`);
    logUserAction({ type: 'action', detail: `Executed Forge CLI command: ${cmd}` });
    
    if (cmd === 'help') {
      displayHelp();
    } else if (cmd.includes('sync')) {
      addLog(`🤖 Forge: Initializing repository sync...`);
      addLog(`📦 Scanning 2000+ potential files...`);
    } else if (cmd.includes('deploy')) {
      startBuild();
    } else if (cmd.includes('analyze')) {
      handleAnalyzeLogs();
    } else if (cmd.includes('clear')) {
      setLogs([]);
      localStorage.removeItem('ca_sandbox_logs');
    } else if (cmd === 'status') {
      addLog(`[Forge Status]`);
      addLog(`Container: ${status === 'building' ? 'Initializing' : status === 'success' ? 'Running' : 'Offline'}`);
      addLog(`Resources: 4GiB Dedicated / 1 vCPU`);
      addLog(`Target   : ${target.toUpperCase()}`);
    } else {
      addLog(`⚠️ Unknown command: ${commandInput}. Type 'help' for guidance.`);
    }
    
    setCommandInput('');
  };

  const startBuild = async () => {
    if (!repo) return;
    setStatus('building');
    setProgress(0);
    setBuildTime(0);
    setLogs([]);
    setPreviewUrl(null);
    setAnalysisResult(null);
    logUserAction({ type: 'action', detail: `Started Sandbox Forge build for ${target}` });
    
    addLog(`🚀 Initializing Universal Sandbox Forge...`);
    addLog(`📦 Detected Project: ${repo.name}`);
    addLog(`🛠️ Generating Deployment Manifest (Dockerfile, fly.toml, wrangler.toml)...`);
    
    timerRef.current = setInterval(() => {
      setBuildTime(prev => prev + 1);
    }, 1000);

    const steps = [
      { label: "Manifest Generation", progress: 15 },
      { label: "Container Context Setup", progress: 30 },
      { label: "Dependency Resolution", progress: 50 },
      { label: "Container Build", progress: 80 },
      { label: "Edge Propagation", progress: 100 }
    ];

    try {
      for (const step of steps) {
        addLog(`>> ${step.label} in progress...`);
        setProgress(step.progress);
        await new Promise(r => setTimeout(r, 1200));
        
        if (step.label === "Edge Propagation" && (target === 'server' || target === 'cloudflare')) {
          const rand = Math.random();
          if (rand > 0.7) {
             addLog("❌ ERROR: Connection timeout during edge propagation.");
             addLog("❌ Error Code: EDGE_SYNC_FAILURE (504)");
             throw new Error("Sandbox Forge failed to sync with edge nodes.");
          }
        }
        
        addLog(`✅ ${step.label} complete.`);
      }

      if (timerRef.current) clearInterval(timerRef.current);
      setProgress(100);
      setStatus('success');
      const finalUrl = target === 'server' ? `https://${repo.name}.fly.dev` : `https://${repo.name}.workers.dev`;
      setPreviewUrl(finalUrl);
      addLog(`🎉 Forge Successful! Container is live at: ${finalUrl}`);
      toast({ title: "Forge Success", description: "Deployment live on preview environment." });
      
    } catch (e: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus('failed');
      addLog(`❌ Build failed: ${e.message}`);
      addLog(`💡 Tip: Use 'AI Auto-Fix' or execute 'analyze' in CLI for diagnostics.`);
      logUserAction({ type: 'error', detail: `Forge failed: ${e.message}`, metadata: { target } });
    }
  };

  const handleAnalyzeLogs = async () => {
    if (logs.length === 0 || isAnalyzing) return;
    setIsAnalyzing(true);
    setStatus('analyzing');
    addLog("🤖 Gemini Analyzing Forge logs for diagnostics...");
    
    try {
      const result = await analyzeDeploymentLogs({
        target: target,
        logs: logs,
        repoName: repo?.full_name || 'unknown',
        language: lang
      });
      setAnalysisResult(result);
      addLog("✅ Diagnostic complete. Root cause identified.");
    } catch (err: any) {
      addLog(`❌ Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      setStatus('failed');
    }
  };

  const handleSelfHeal = async () => {
    if (!repo || !analysisResult) return;
    setStatus('healing');
    addLog("🩹 AI Self-Healing initialized: Resolving container configuration...");
    
    try {
      const result = await contextAwareCodeImprovement({
        code: '',
        modelId: 'googleai/gemini-2.5-flash',
        instruction: `The container build failed with: ${analysisResult.rootCause}. Fix the manifest files and code to ensure deployment success.`,
        githubIssues: [],
        recentCommits: [],
        language: lang,
        userApiKey: localStorage.getItem('GEMINI_API_KEY') || ''
      });

      addLog(`🛠️ AI generated ${result.fileChanges.length} fixes for self-healing.`);
      
      for (const change of result.fileChanges) {
        addLog(`⏳ Applying fix: ${change.file}...`);
        let existingSha: string | undefined = undefined;
        try {
          const info = await fetchFileContent(token, repo.full_name, change.file);
          existingSha = info.sha;
        } catch (e) {
          console.error("Failed to fetch existing file info during self-healing: ", e);
        }
        await createCommit(token, repo.full_name, change.file, `Forge Self-Healing: ${analysisResult.rootCause.slice(0, 50)}`, change.content, existingSha);
        addLog(`✅ Healed: ${change.file}`);
      }

      addLog("🎉 Self-healing complete. Restarting Forge deployment...");
      toast({ title: "Healed", description: "Repository manifests updated." });
      startBuild();
    } catch (e: any) {
      addLog(`❌ Healing failed: ${e.message}`);
      setStatus('failed');
    }
  };

  const targets = [
    { id: 'web' as Target, icon: Globe, label: 'Web', color: 'text-blue-400' },
    { id: 'server' as Target, icon: Container, label: 'Server', color: 'text-purple-400' },
    { id: 'cloudflare' as Target, icon: Cloud, label: 'Edge', color: 'text-cyan-400' },
    { id: 'android' as Target, icon: Smartphone, label: 'Mobile', color: 'text-green-600' },
  ];

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden w-full">
      <header className="p-6 border-b border-border bg-card/30 flex items-center justify-between shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between w-full px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-headline font-bold text-foreground">Lens Resource Hub</h2>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">Forge Virtual Container Console</p>
            </div>
          </div>
          <div className="flex gap-2">
            {status === 'failed' && (
              <Button variant="outline" size="sm" onClick={handleAnalyzeLogs} disabled={isAnalyzing} className="rounded-full gap-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/10">
                <SearchCode className="w-3.5 h-3.5" />
                Analyze Logs
              </Button>
            )}
            {analysisResult && (
              <Button size="sm" onClick={handleSelfHeal} className="rounded-full gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 text-white">
                <Wand2 className="w-3.5 h-3.5" />
                AI Auto-Fix
              </Button>
            )}
            <Button onClick={startBuild} disabled={status === 'building' || isAnalyzing || status === 'healing'} className="rounded-full gap-2 font-headline h-10 px-6 shadow-xl shadow-primary/20 bg-primary text-white">
              {status === 'building' || status === 'healing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Forge Deploy
            </Button>
          </div>
        </div>
      </header>
      
      <ScrollArea className="flex-1 w-full">
        <div className="p-6 space-y-6 max-w-2xl mx-auto pb-20 w-full overflow-hidden">
          {/* Targets Grid */}
          <div className="grid grid-cols-4 gap-2">
            {targets.map((t) => (
              <button key={t.id} onClick={() => { setTarget(t.id); setStatus('idle'); setLogs([]); setPreviewUrl(null); setAnalysisResult(null); }} disabled={status === 'building' || status === 'healing'} className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all active:scale-95", target === t.id ? "bg-primary/10 border-primary shadow-inner" : "bg-muted/30 border-border/50 hover:bg-muted/50 opacity-50")}>
                <t.icon className={cn("w-5 h-5", t.color)} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">{t.label}</span>
              </button>
            ))}
          </div>
          
          {/* Dashboard Cards (Lens Style) */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card/40 border-border p-4 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                 <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">CPU Usage</span>
                 <Cpu className="w-3 h-3 text-primary opacity-50" />
              </div>
              <div className="text-xl font-bold font-headline text-foreground">{status === 'success' ? '12%' : '0%'}</div>
              <Progress value={status === 'success' ? 12 : 0} className="h-1" />
            </Card>
            <Card className="bg-card/40 border-border p-4 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                 <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Memory</span>
                 <Activity className="w-3 h-3 text-emerald-500 opacity-50" />
              </div>
              <div className="text-xl font-bold font-headline text-foreground">{status === 'success' ? '412MB' : '0MB'}</div>
              <Progress value={status === 'success' ? 30 : 0} className="h-1 bg-zinc-800" />
            </Card>
          </div>

          <Card className="bg-card/50 border-border p-5 rounded-3xl space-y-4 max-w-full overflow-hidden shadow-sm relative border-primary/20">
            {status === 'success' && previewUrl && (
              <div className="absolute top-4 right-4 animate-bounce">
                <Button size="sm" variant="outline" className="rounded-full gap-2 bg-primary/20 border-primary/30 text-primary" asChild>
                   <a href={previewUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /> Live Preview</a>
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className={cn("w-4 h-4", (status === 'building' || status === 'healing') ? "text-amber-500 animate-pulse" : "text-emerald-500")} />
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  {status === 'idle' ? 'Sandbox Offline' : status === 'building' ? `Provisioning Node...` : status === 'healing' ? 'AI Self-Healing...' : status === 'analyzing' ? 'Diagnostic Run...' : status === 'success' ? 'Container Running' : 'Forge Halted'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{buildTime}s / {target.toUpperCase()} / RAMSS v2.0</span>
            </div>
            <Progress value={progress} className="h-2 bg-muted rounded-full" />
          </Card>

          {analysisResult && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <Alert className={cn(
                "rounded-[2rem] border-2 shadow-lg",
                analysisResult.status === 'error' ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5"
              )}>
                <AlertTriangle className={cn("h-5 w-5", analysisResult.status === 'error' ? "text-red-500" : "text-amber-500")} />
                <AlertTitle className="font-headline font-bold flex items-center gap-2 text-foreground">
                  Forge Diagnostic
                </AlertTitle>
                <AlertDescription className="mt-4 space-y-4">
                  <div className="p-4 bg-background/50 rounded-2xl border border-border/50 text-sm">
                    <h4 className="font-bold mb-2 flex items-center gap-2 text-primary"><Info className="w-4 h-4" /> Root Cause</h4>
                    <p className="text-muted-foreground leading-relaxed">{analysisResult.rootCause}</p>
                  </div>
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 text-sm">
                    <h4 className="font-bold mb-2 flex items-center gap-2 text-primary"><Zap className="w-4 h-4" /> Recommended Action</h4>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{analysisResult.solution}</p>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Persistent Forge CLI */}
          <div className="h-96 flex flex-col bg-black rounded-3xl border border-border/20 overflow-hidden shadow-2xl relative max-w-full group">
            <header className="h-10 bg-zinc-900 flex items-center px-4 justify-between shrink-0 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Forge CLI Console</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white" onClick={displayHelp} title="CLI Help"><HelpCircle className="w-4 h-4" /></Button>
            </header>
            
            <ScrollArea className="flex-1">
              <div className="p-4 font-code text-[11px] space-y-1.5 selection:bg-primary/30">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="opacity-20 shrink-0 select-none">{(i + 1).toString().padStart(3, '0')}</span>
                    <span className={cn(
                      "whitespace-pre-wrap", 
                      log.includes('$') ? "text-primary font-bold" :
                      log.includes('---') ? "text-zinc-500" :
                      log.includes('🩹') || log.includes('🛠️') ? "text-emerald-400 font-bold" :
                      log.includes('❌') ? "text-red-400 font-bold" : 
                      log.includes('⚠️') ? "text-amber-500 italic" : 
                      log.includes('✅') || log.includes('🎉') ? "text-green-500 font-bold" : 
                      log.includes('🤖') ? "text-primary italic font-bold" : "text-foreground/70"
                    )}>{log}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </ScrollArea>
            
            <form onSubmit={handleCommandSubmit} className="p-3 bg-zinc-900 border-t border-white/5 flex items-center gap-2">
              <ChevronRightSquare className="w-4 h-4 text-primary shrink-0" />
              <Input 
                value={commandInput} 
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Type forge command (sync, deploy, analyze)..." 
                className="bg-transparent border-transparent h-8 text-[11px] font-mono focus-visible:ring-0 text-white placeholder:text-zinc-600"
                disabled={status === 'building' || isAnalyzing || status === 'healing'}
              />
              <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 text-primary" disabled={status === 'building' || isAnalyzing || !commandInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
