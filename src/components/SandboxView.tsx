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
  Shield,
  Layers,
  Settings,
  Plus,
  RefreshCw,
  Power,
  Trash2,
  FolderOpen
} from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { contextAwareCodeImprovement } from '@/ai/flows/context-aware-code-improvement';

interface SandboxViewProps {
  token: string;
  repo: GitHubRepo | null;
}

interface DaytonaWorkspace {
  id: string;
  name: string;
  repository: string;
  targetProvider: 'local' | 'gcp' | 'aws' | 'cloudflare';
  status: 'running' | 'building' | 'stopped' | 'error';
  url: string;
}

type ServerStatus = 'online' | 'starting' | 'offline';

export function SandboxView({ token, repo }: SandboxViewProps) {
  const [serverStatus, setServerStatus] = useState<ServerStatus>('online');
  const [daytonaLogs, setDaytonaLogs] = useState<string[]>([]);
  const [targetProvider, setTargetProvider] = useState<'local' | 'gcp' | 'aws' | 'cloudflare'>('cloudflare');
  const [activeTab, setActiveTab] = useState<'workspaces' | 'cli' | 'loop' | 'settings'>('workspaces');
  const [serverEndpoint, setServerEndpoint] = useState('https://daytona.cursor.internal');
  const [commandInput, setCommandInput] = useState('');
  
  // Daytona Workspaces state
  const [workspaces, setWorkspaces] = useState<DaytonaWorkspace[]>([
    { id: 'ws1', name: 'devika-agent-workspace', repository: repo?.name || 'cursor-app', targetProvider: 'cloudflare', status: 'running', url: 'https://daytona.workspace-1.internal' },
    { id: 'ws2', name: 'mem0-memory-playground', repository: 'mem0-engine', targetProvider: 'cloudflare', status: 'stopped', url: 'https://daytona.workspace-2.internal' },
    { id: 'ws3', name: 'daytona-micro-router', repository: 'daytona-core', targetProvider: 'local', status: 'building', url: 'https://daytona.workspace-3.internal' },
  ]);

  // Devika Autoloop State
  const [isLoopActive, setIsLoopActive] = useState(false);
  const [loopLogs, setLoopLogs] = useState<string[]>([
    'Devika Self-Healing loop ready.',
    'System standby: Trigger autonomous code correction processes by deploying a failing commit.'
  ]);

  const logEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setDaytonaLogs([
      `[Daytona Server] Configuration loaded from ${serverEndpoint}`,
      `[Daytona Server] Connected to Provider Provider Cloudflare v1.3.1`,
      `[Daytona Server] Active dynamic workspaces found: ${workspaces.length}`,
      `👉 Ready. Run 'daytona help' in the terminal for guidance.`
    ]);
  }, [serverEndpoint]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [daytonaLogs]);

  const addLog = (msg: string) => {
    setDaytonaLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const executeCommand = (cmd: string) => {
    addLog(`$ daytona ${cmd}`);
    const parts = cmd.toLowerCase().trim().split(' ');
    const base = parts[0];

    setTimeout(() => {
      switch (base) {
        case 'help':
          addLog("📖 Daytona CLI Commands Helper:");
          addLog("  daytona workspace create <name>  Create a new microservice environment");
          addLog("  daytona workspace delete <name>  Delete environment and free container size");
          addLog("  daytona provider install <name>  Mount a cloud provider integration (aws, cloudflare, gcp)");
          addLog("  daytona server configure         Update target Daytona instance URL");
          addLog("  daytona profile list             Show active administrator keys and profiles");
          break;
        case 'workspace':
          if (parts[1] === 'create' && parts[2]) {
            const newWs: DaytonaWorkspace = {
              id: Math.random().toString(36).slice(2, 9),
              name: parts[2],
              repository: repo?.name || 'cursor-app',
              targetProvider: targetProvider,
              status: 'running',
              url: `https://daytona.${parts[2]}.internal`
            };
            setWorkspaces(prev => [newWs, ...prev]);
            addLog(`✅ Successfully created running sandbox container: "${parts[2]}"`);
            toast({ title: "Workspace Spawned", description: `Daytona environment ${parts[2]} initialized.` });
          } else if (parts[1] === 'delete' && parts[2]) {
            setWorkspaces(prev => prev.filter(w => w.name !== parts[2]));
            addLog(`✅ Deleted workspace container: "${parts[2]}"`);
          } else {
            addLog("⚠️ Usage: daytona workspace create <name> / daytona workspace delete <name>");
          }
          break;
        case 'provider':
          if (parts[1] === 'install') {
            addLog(`📦 Fetching provider template: "daytona-provider-${parts[2]}" ...`);
            addLog(`✅ Mounted provider target: "${parts[2]}"`);
          } else {
            addLog("⚠️ Usage: daytona provider install <aws/gcp/cloudflare>");
          }
          break;
        case 'server':
          addLog(`Configured endpoint: "${serverEndpoint}"`);
          break;
        default:
          addLog(`⚠️ Unknown Daytona CLI command: "${cmd}". Type 'help' for support.`);
          break;
      }
    }, 400);
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    executeCommand(commandInput.trim());
    setCommandInput('');
  };

  // Toggle Workspace states
  const toggleWorkspace = (id: string, currentStatus: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id === id) {
        const nextStatus: DaytonaWorkspace['status'] = currentStatus === 'running' ? 'stopped' : 'running';
        addLog(`[Workspace Server] Signalled container ${w.name} state change to: [${nextStatus}]`);
        return { ...w, status: nextStatus };
      }
      return w;
    }));
    toast({ title: "State Toggled", description: "Daytona container sequence dispatched." });
  };

  const handleCreateQuickWorkspace = () => {
    executeCommand(`workspace create daytona-micro-microservice`);
  };

  // Trigger Devika Auto Healing execution loop
  const triggerDevikaLoop = () => {
    if (isLoopActive) {
      setIsLoopActive(false);
      setLoopLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Devika-Daytona healing loop paused.`]);
    } else {
      setIsLoopActive(true);
      setLoopLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Intrusive execution initialized in "devika-agent-workspace"`]);
      
      // Step 1
      setTimeout(() => {
        setLoopLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🔎 DETECTED: Wrangler deploy failure: "Cloudflare KV lock exception"`]);
      }, 1500);

      // Step 2
      setTimeout(() => {
        setLoopLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🩹 HEAL CYCLE: Initiating Devika task splitting correction sequence...`]);
      }, 3000);

      // Step 3
      setTimeout(() => {
        setLoopLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🛠️ REGENERATED: Updated wrangler.toml binding settings`]);
      }, 4500);

      // Step 4
      setTimeout(() => {
        setLoopLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🎉 DEPLOYED: Re-executing Daytona sandbox test cycle - 100% SUCCESS`]);
        setIsLoopActive(false);
      }, 6000);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden w-full select-none" id="server-preview-daytona">
      {/* HEADER SECTION */}
      <header className="p-6 border-b border-border bg-card/10 flex items-center shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between w-full px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-950/30 border border-sky-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-sky-400 rotate-12" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Daytona Sandbox Console</h2>
                <Badge variant="outline" className="text-[7px]_uppercase tracking-wider font-mono text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                  Microservices Controller
                </Badge>
              </div>
              <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-tighter">Daytona Development Environment Gateway</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setServerStatus(prev => prev === 'online' ? 'offline' : 'online')} className="rounded-xl h-9 text-[10px] uppercase font-bold gap-1.5 font-mono">
              <Power className={cn("w-3.5 h-3.5", serverStatus === 'online' ? "text-emerald-500" : "text-zinc-600")} />
              Server: {serverStatus}
            </Button>
            <Button onClick={handleCreateQuickWorkspace} disabled={serverStatus !== 'online'} className="rounded-xl font-mono h-9 text-[10px] px-4 shadow-xl shadow-sky-500/15 bg-sky-600 hover:bg-sky-500 text-white font-bold gap-1">
              <Plus className="w-3.5 h-3.5" /> Workspace
            </Button>
          </div>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <div className="flex-1 overflow-hidden max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6">
        
        {/* LEFT NAV PANEL */}
        <div className="w-full md:w-52 shrink-0 flex flex-col gap-1.5">
          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground pl-2 mb-1">Configuration</span>
          
          <button onClick={() => setActiveTab('workspaces')} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all", activeTab === 'workspaces' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Container className="w-4 h-4" /> Workspaces
          </button>
          <button onClick={() => setActiveTab('cli')} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all", activeTab === 'cli' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Terminal className="w-4 h-4" /> Daytona CLI
          </button>
          <button onClick={() => setActiveTab('loop')} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all", activeTab === 'loop' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <RefreshCw className="w-4 h-4" /> Autonomous Healing
          </button>
          <button onClick={() => setActiveTab('settings')} className={cn("flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all", activeTab === 'settings' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Settings className="w-4 h-4" /> Profile Config
          </button>

          <div className="mt-8 bg-card/45 border border-border/50 rounded-2xl p-4 space-y-3">
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Resource Metrics</span>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono text-foreground/80">
                <span>Active Nodes</span>
                <span>{workspaces.filter(w => w.status === 'running').length}/3</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-foreground/80">
                <span>CPU Core</span>
                <span>{serverStatus === 'online' ? '3.5%' : '0%'}</span>
              </div>
              <Progress value={serverStatus === 'online' ? 24 : 0} className="h-1 bg-muted" />
            </div>
          </div>
        </div>

        {/* RIGHT METRIC OR VIEW PANEL */}
        <div className="flex-1 overflow-hidden min-w-0">
          
          {/* TAB 1: WORKSPACES LIST */}
          {activeTab === 'workspaces' && (
            <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-center shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Daytona Container Workspaces</span>
                <span className="text-[10px] font-mono text-muted-foreground">Provider: {targetProvider}</span>
              </div>

              <ScrollArea className="flex-1 w-full border border-border/40 rounded-2xl bg-card/15 p-4">
                <div className="space-y-3.5">
                  {workspaces.map((w) => (
                    <Card key={w.id} className="bg-card/40 border-border p-4 rounded-xl flex items-center justify-between gap-4 group hover:border-primary/30 transition-all">
                      <div className="space-y-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <Container className="w-4 h-4 text-sky-400 shrink-0" />
                          <h4 className="text-xs font-bold font-mono tracking-tight text-foreground truncate">{w.name}</h4>
                          <Badge variant="outline" className={cn("text-[7px]_uppercase font-mono font-bold py-0.5", 
                            w.status === 'running' ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5 animate-pulse" : 
                            w.status === 'building' ? "text-amber-500 border-amber-500/20 bg-amber-500/5 animate-spin" : 
                            "text-zinc-600 border-zinc-700 bg-zinc-800/10"
                          )}>
                            {w.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-mono">
                          <span>Repo: {w.repository}</span>
                          <span>•</span>
                          <span>Provider: {w.targetProvider}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {w.status === 'running' && (
                          <Button size="sm" variant="outline" className="rounded-lg h-8 text-[9px] font-mono gap-1 border-sky-500/20 bg-sky-500/10 text-sky-400" asChild>
                            <a href={w.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" /> Live
                            </a>
                          </Button>
                        )}
                        <Button 
                          onClick={() => toggleWorkspace(w.id, w.status)} 
                          disabled={w.status === 'building'} 
                          variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                        >
                          <Power className={cn("w-3.5 h-3.5", w.status === 'running' ? "text-emerald-400" : "text-muted-foreground")} />
                        </Button>
                        <Button 
                          onClick={() => executeCommand(`workspace delete ${w.name}`)}
                          variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* TAB 2: DAYTONA CLI */}
          {activeTab === 'cli' && (
            <div className="h-full flex flex-col space-y-4 overflow-hidden animate-in fade-in duration-200">
              <div className="flex justify-between items-center shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Interactive Daytona CLI Shell</span>
                <Button variant="ghost" onClick={() => setDaytonaLogs([])} className="h-6 text-[9px] font-mono opacity-60">Clear Logs</Button>
              </div>

              <div className="flex-1 bg-black rounded-2xl border border-border/40 overflow-hidden flex flex-col min-h-0">
                <header className="h-8 bg-zinc-950 px-4 flex items-center justify-between border-b border-white/5 select-none shrink-0">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-sky-400" />
                    <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest font-bold">daytona-cli</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                    <span className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                  </div>
                </header>

                <ScrollArea className="flex-1 bg-zinc-950 p-4">
                  <div className="font-mono text-[9px] space-y-1.5 text-zinc-300 selection:bg-sky-500/40">
                    {daytonaLogs.map((log, i) => (
                      <div key={i} className="flex gap-2 text-left shrink-0">
                        <span className="opacity-15 select-none shrink-0 font-bold">{(i + 1).toString().padStart(3, '0')}</span>
                        <span className={cn("whitespace-pre-wrap leading-relaxed", 
                          log.startsWith('$') ? "text-sky-400 font-bold" : 
                          log.includes('✅') ? "text-emerald-400 font-bold" : 
                          log.includes('⚠️') ? "text-amber-500 font-medium" : 
                          "text-zinc-300/90"
                        )}>{log}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </ScrollArea>

                <form onSubmit={handleCommandSubmit} className="p-2 bg-zinc-950 border-t border-white/5 flex items-center gap-2 justify-between shrink-0">
                  <ChevronRightSquare className="w-4 h-4 text-sky-400 shrink-0" />
                  <Input 
                    value={commandInput} 
                    onChange={(e) => setCommandInput(e.target.value)}
                    placeholder="E.g. help, workspace create my-service, provider install cloudflare" 
                    className="flex-1 bg-transparent border-transparent h-8 text-[10px] font-mono focus-visible:ring-0 text-white placeholder:text-zinc-600 focus-visible:outline-none"
                    disabled={serverStatus !== 'online'}
                  />
                  <Button type="submit" size="icon" variant="ghost" className="h-8 w-8 text-sky-400" disabled={serverStatus !== 'online' || !commandInput.trim()}>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: DEVIKA-DAYTONA HEALING LOOP */}
          {activeTab === 'loop' && (
            <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-200">
              <div className="flex justify-between items-center shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Autonomous Diagnostics & Healing</span>
                <Button 
                  onClick={triggerDevikaLoop} 
                  className={cn("h-7 px-3 text-[9px] font-semibold uppercase rounded-lg shadow-lg font-mono", 
                    isLoopActive ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" : "bg-sky-600 hover:bg-sky-500 text-white"
                  )}
                >
                  {isLoopActive ? "Halt Loop" : "Activate Loop"}
                </Button>
              </div>

              <Card className="bg-card/15 border border-border/40 p-4 rounded-2xl space-y-4 flex flex-col min-h-0 flex-1">
                <div className="flex justify-between items-start">
                  <div className="text-left space-y-0.5">
                    <h3 className="text-xs font-bold text-foreground">Devika Autoloop Status</h3>
                    <p className="text-[9px] text-muted-foreground">Task splitting automatic error detection feedback loop</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[8px] uppercase tracking-wider font-mono px-2 py-0.5", 
                    isLoopActive ? "text-emerald-500 border-emerald-500/25 bg-emerald-500/5 animate-pulse" : "text-zinc-600 border-zinc-800"
                  )}>
                    {isLoopActive ? "Loop Running" : "Standby"}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2.5 shrink-0 select-none">
                  {[
                    { label: "Cycle precision", val: "99.4%" },
                    { label: "Daytona Sandboxing", val: "Online" },
                    { label: "Mean Healing duration", val: "4.2s" }
                  ].map((m, idx) => (
                    <div key={idx} className="bg-card/45 border border-border/50 rounded-xl p-3 text-left">
                      <span className="text-[7.5px] uppercase tracking-wider font-mono text-muted-foreground">{m.label}</span>
                      <p className="text-sm font-bold font-mono text-foreground mt-0.5">{m.val}</p>
                    </div>
                  ))}
                </div>

                {/* Healing terminal output */}
                <div className="flex-1 min-h-0 bg-black/60 rounded-xl border border-border/40 p-3 flex flex-col">
                  <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest pl-1 border-b border-white/5 pb-1 select-none shrink-0 text-left">Internal Healing pipeline logs</span>
                  <ScrollArea className="flex-1 mt-2">
                    <div className="font-mono text-[9px] leading-relaxed text-zinc-300 space-y-1 text-left select-text">
                      {loopLogs.map((l, idx) => (
                        <div key={idx} className={cn(
                          l.includes('🔎') ? "text-rose-400 italic" : 
                          l.includes('🩹') ? "text-amber-400 font-bold" : 
                          l.includes('🎉') ? "text-emerald-400 font-bold" : "text-zinc-400"
                        )}>
                          {l}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4: SETTINGS CONFIG */}
          {activeTab === 'settings' && (
            <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-left">Daytona profile & global settings</span>
              
              <div className="border border-border/40 rounded-2xl bg-card/15 p-5 space-y-5 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold font-mono tracking-wider text-muted-foreground">Daytona Target Endpoint</label>
                  <Input 
                    value={serverEndpoint} onChange={(e) => setServerEndpoint(e.target.value)}
                    className="h-9 bg-background border-border text-xs font-mono text-foreground/95"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold font-mono tracking-wider text-muted-foreground">Target Cloud Integration Provider</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'cloudflare', icon: Cloud, label: 'Cloudflare' },
                      { id: 'gcp', icon: Globe, label: 'GCP Edge' },
                      { id: 'aws', icon: Server, label: 'AWS EC2' },
                      { id: 'local', icon: Container, label: 'Local Docker' }
                    ].map((p) => (
                      <button 
                        key={p.id} type="button" 
                        onClick={() => { setTargetProvider(p.id as any); toast({ title: "Provider Swapped", description: `Daytona target updated to ${p.id}.` }); }}
                        className={cn("flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all active:scale-95", 
                          targetProvider === p.id ? "bg-primary/10 border-primary text-primary font-bold shadow-inner" : "bg-background border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <p.icon className="w-4 h-4 mb-2" />
                        <span className="text-[8px] uppercase tracking-wider font-mono font-bold leading-none">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-card/45 border border-border/40 rounded-xl p-4 space-y-3 font-mono text-[9px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>ADMINISTRATOR KEYS</span>
                    <span className="text-emerald-500 font-bold">MOUNTED</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CLI VERSION</span>
                    <span>v2.1.2-daytona-edge</span>
                  </div>
                  <div className="flex justify-between">
                    <span>METRIC RESOLVER</span>
                    <span>http://localhost:3000/__metrics</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
