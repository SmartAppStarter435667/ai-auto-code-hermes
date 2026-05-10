"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plug, 
  ExternalLink, 
  CheckCircle2, 
  Cloud, 
  Database, 
  Layout, 
  Triangle, 
  Palette, 
  Zap,
  ShieldCheck,
  Search,
  Settings2,
  Boxes,
  Github,
  Globe,
  MessageSquare,
  Container,
  Server,
  FileText,
  Mail,
  Calendar,
  Layers,
  Box,
  Music,
  Video,
  PenTool,
  Workflow,
  Bot,
  Sparkles
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MCPConnector {
  id: string;
  name: string;
  description: string;
  provider: string;
  icon: React.ReactNode;
  status: 'active' | 'offline';
  capabilities: string[];
  type: 'design' | 'devops' | 'database' | 'productivity' | 'creative' | 'engineering' | 'communication' | 'ai';
  setupUrl?: string;
}

const CONNECTORS: MCPConnector[] = [
  // AI & External Assistants
  { id: 'claude', name: 'Claude (Anthropic)', description: 'Bridge context from Claude conversations and artifacts.', provider: 'Anthropic', icon: <MessageSquare className="w-5 h-5 text-orange-500" />, status: 'offline', capabilities: ['Artifact Sync', 'History Search'], type: 'ai' },
  { id: 'chatgpt', name: 'ChatGPT (OpenAI)', description: 'Query your ChatGPT chat history and GPT knowledge bases.', provider: 'OpenAI', icon: <Bot className="w-5 h-5 text-emerald-500" />, status: 'offline', capabilities: ['Chat History', 'Knowledge Retrieval'], type: 'ai' },
  
  // Productivity & Collaboration
  { id: 'google-drive', name: 'Google Drive', description: 'Query documents and specs directly from Drive.', provider: 'Google', icon: <FileText className="w-5 h-5 text-blue-500" />, status: 'offline', capabilities: ['Doc Reading', 'File Search'], type: 'productivity', setupUrl: 'https://workspace.google.com/' },
  { id: 'gmail', name: 'Gmail', description: 'Analyze communication context and project threads.', provider: 'Google', icon: <Mail className="w-5 h-5 text-red-500" />, status: 'offline', capabilities: ['Thread Summary', 'Action Items'], type: 'productivity' },
  { id: 'google-calendar', name: 'Google Calendar', description: 'Schedule and manage project milestones.', provider: 'Google', icon: <Calendar className="w-5 h-5 text-green-500" />, status: 'offline', capabilities: ['Event Sync'], type: 'productivity' },
  { id: 'notion', name: 'Notion', description: 'Connect deep technical wiki and roadmap context.', provider: 'Notion Labs', icon: <Boxes className="w-5 h-5 text-foreground" />, status: 'offline', capabilities: ['Wiki Search', 'Block Reading'], type: 'productivity' },
  { id: 'sharepoint', name: 'SharePoint', description: 'Access enterprise document repositories.', provider: 'Microsoft', icon: <Triangle className="w-5 h-5 text-blue-600 rotate-180" />, status: 'offline', capabilities: ['Asset Retrieval'], type: 'productivity' },
  { id: 'outlook', name: 'Outlook', description: 'Sync enterprise calendar and email tasks.', provider: 'Microsoft', icon: <Mail className="w-5 h-5 text-blue-400" />, status: 'offline', capabilities: ['Calendar Sync'], type: 'productivity' },

  // Creative Suite
  { id: 'figma', name: 'Figma', description: 'Extract design assets and component styles.', provider: 'Figma', icon: <PenTool className="w-5 h-5 text-purple-500" />, status: 'offline', capabilities: ['UI Analysis', 'Asset Export'], type: 'design', setupUrl: 'https://www.figma.com/' },
  { id: 'adobe-cc', name: 'Adobe Creative Cloud', description: 'Extract design assets and style metadata.', provider: 'Adobe', icon: <PenTool className="w-5 h-5 text-red-600" />, status: 'offline', capabilities: ['Asset Extraction', 'Style Mining'], type: 'creative' },
  { id: 'blender', name: 'Blender', description: 'Query 3D scene data and object metadata.', provider: 'Open Source', icon: <Box className="w-5 h-5 text-orange-500" />, status: 'offline', capabilities: ['Scene Context', 'Geometry Info'], type: 'creative' },
  
  // Engineering & Advanced
  { id: 'autodesk', name: 'Autodesk Fusion', description: 'Direct CAD data context for engineering tasks.', provider: 'Autodesk', icon: <Layers className="w-5 h-5 text-cyan-500" />, status: 'offline', capabilities: ['BOM Access', 'Part Specs'], type: 'engineering' },
  { id: 'ableton', name: 'Ableton Live', description: 'Contextual analysis for audio-focused projects.', provider: 'Ableton', icon: <Music className="w-5 h-5 text-foreground" />, status: 'offline', capabilities: ['Track Metadata'], type: 'engineering' },

  // Standard DevOps & Database
  { id: 'cloudflare', name: 'Cloudflare Edge', description: 'Manage Workers, R2, and D1 directly.', provider: 'Cloudflare', icon: <Cloud className="w-5 h-5 text-orange-400" />, status: 'offline', capabilities: ['Logs', 'D1 Schema'], type: 'devops', setupUrl: 'https://dash.cloudflare.com/' },
  { id: 'vercel', name: 'Vercel Connect', description: 'Autonomous deployments and domain orchestration.', provider: 'Vercel', icon: <Triangle className="w-5 h-5 text-foreground" />, status: 'offline', capabilities: ['Preview URLs'], type: 'devops' },
  { id: 'supabase', name: 'Supabase', description: 'Direct Postgres schema analysis and migrations.', provider: 'Supabase', icon: <Database className="w-5 h-5 text-emerald-500" />, status: 'offline', capabilities: ['Schema Mapping'], type: 'database' },
  
  // Communication
  { id: 'slack', name: 'Slack Hub', description: 'Team notifications and AI alerts.', provider: 'Salesforce', icon: <MessageSquare className="w-5 h-5 text-emerald-500" />, status: 'offline', capabilities: ['Alert Forwarding'], type: 'communication' },
  { id: 'zoom', name: 'Zoom', description: 'Analyze meeting summaries and action items.', provider: 'Zoom Inc.', icon: <Video className="w-5 h-5 text-blue-500" />, status: 'offline', capabilities: ['Meeting Insight'], type: 'communication' }
];

interface IntegrationHubViewProps {
  onNavigateToSettings?: () => void;
}

export function IntegrationHubView({ onNavigateToSettings }: IntegrationHubViewProps) {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  
  const [lang, setLang] = useState('English');
  useEffect(() => { setLang(localStorage.getItem('ca_preferred_language') || 'English'); }, []);

  const t = (key: string) => {
    const dict: Record<string, any> = {
      'title': { English: 'Universal MCP Hub', Japanese: 'ユニバーサル MCP ハブ' },
      'subtitle': { English: 'Orchestrate across professional suites and external AIs.', Japanese: '外部ツールとAIを統合管理' },
      'active': { English: 'Synchronized', Japanese: '同期済み' },
      'offline': { English: 'Vault Setup Required', Japanese: '要設定' }
    };
    return dict[key]?.[lang] || dict[key]?.English || key;
  };

  const handleSetupClick = (connector: MCPConnector) => {
    toast({
      title: "Navigation",
      description: `Opening System Vault for ${connector.name}...`,
    });
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  const filtered = CONNECTORS.filter(c => {
    const matchesFilter = c.name.toLowerCase().includes(filter.toLowerCase()) || c.type.toLowerCase().includes(filter.toLowerCase());
    if (activeTab === 'all') return matchesFilter;
    return matchesFilter && c.type === activeTab;
  });

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden w-full">
      <header className="p-8 border-b border-border bg-card/30 shrink-0">
        <div className="max-w-5xl mx-auto space-y-6 px-4 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[2rem] bg-primary/20 flex items-center justify-center shadow-inner">
                <Workflow className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-headline font-bold text-foreground">{t('title')}</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{t('subtitle')}</p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 gap-2 px-5 py-2 rounded-full font-bold">
              <ShieldCheck className="w-4 h-4" /> Multi-Agent Protocol v3.0
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search (Claude, GPT, Drive, Adobe...)" className="pl-11 h-14 rounded-2xl bg-card border-border/50 shadow-sm" />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="shrink-0">
               <TabsList className="bg-muted h-14 rounded-2xl p-1 px-2">
                  <TabsTrigger value="all" className="rounded-xl px-6 text-xs font-bold uppercase">All</TabsTrigger>
                  <TabsTrigger value="ai" className="rounded-xl px-6 text-xs font-bold uppercase">AI Hub</TabsTrigger>
                  <TabsTrigger value="productivity" className="rounded-xl px-6 text-xs font-bold uppercase">Work</TabsTrigger>
                  <TabsTrigger value="devops" className="rounded-xl px-6 text-xs font-bold uppercase">Ops</TabsTrigger>
               </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1 w-full">
        <div className="p-8 space-y-8 max-w-5xl mx-auto pb-24 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((connector) => (
              <Card key={connector.id} className="bg-card/40 border-border rounded-[2.5rem] overflow-hidden hover:border-primary/50 transition-all group shadow-sm ring-1 ring-border/20">
                <CardContent className="p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-background/80 flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors border border-border/50">
                      {connector.icon}
                    </div>
                    <Badge variant="secondary" className="text-[7px] uppercase font-bold bg-muted/50">{connector.type}</Badge>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-base">{connector.name}</h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed h-8">{connector.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 h-10 content-start">
                    {connector.capabilities.map((cap, i) => (
                      <span key={i} className="text-[7px] font-bold uppercase bg-background px-2 py-0.5 rounded-md text-muted-foreground border border-border/30">{cap}</span>
                    ))}
                  </div>

                  <Button variant="outline" onClick={() => handleSetupClick(connector)} className="w-full h-11 rounded-2xl text-[9px] font-bold uppercase tracking-widest gap-2 bg-background/50 group-hover:bg-primary group-hover:text-white transition-all">
                    <Plug className="w-3.5 h-3.5" /> {t('offline')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="p-10 rounded-[3rem] border-primary/20 bg-primary/5 space-y-4 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Zap className="w-24 h-24 text-primary" /></div>
            <h4 className="font-headline font-bold text-xl flex items-center gap-3"><Zap className="w-7 h-7 text-primary" /> Global Orchestration Intelligence</h4>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              By activating these MCP connectors, Gemini and Groq transition from code assistants to **Universal Controllers**. The AI gains the ability to bridge context between Claude, ChatGPT, Google Drive, and your deployment targets, creating a unified intelligent workspace.
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
