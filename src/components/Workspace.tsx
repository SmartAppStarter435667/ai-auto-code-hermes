"use client"

import React, { useState, useEffect, useRef } from 'react';
import { GitHubRepo, GitHubContent, createCommit, GitHubIssue, GitHubPullRequest } from '@/app/lib/github';
import { RepoSelector } from '@/components/RepoSelector';
import { EditorView } from '@/components/EditorView';
import { AIChatView } from '@/components/AIChatView';
import { SettingsView } from '@/components/SettingsView';
import { ActivityView } from '@/components/ActivityView';
import { SandboxView } from '@/components/SandboxView';
import { LegalViews } from '@/components/LegalViews';
import { GlobalAssistantChat } from '@/components/GlobalAssistantChat';
import { IntegrationHubView } from '@/components/IntegrationHubView';
import { 
  FolderGit2, 
  Code2, 
  Sparkles, 
  Settings, 
  History, 
  Terminal, 
  X, 
  Server,
  Boxes
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from "@/components/ui/scroll-area";
import { savePipelineState, PipelineState, Activity } from '@/lib/activity';
import { logUserAction } from '@/lib/interaction-logger';

interface WorkspaceProps {
  token: string;
  selectedRepo: GitHubRepo | null;
  onRepoSelect: (repo: GitHubRepo | null) => void;
  onLogout: () => void;
}

type Tab = 'repos' | 'editor' | 'ai' | 'server' | 'activity' | 'hub' | 'settings' | 'legal';
type ConsoleSize = 'min' | 'mid' | 'max';

const UPLOAD_LOGS_KEY = 'cursor_app_upload_logs';
const CONSOLE_VISIBILITY_KEY = 'ca_console_visible';

export function Workspace({ token, selectedRepo, onRepoSelect, onLogout }: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('repos');
  const [legalPage, setLegalPage] = useState<'tos' | 'privacy' | 'corporate'>('tos');
  const [activeFile, setActiveFile] = useState<GitHubContent | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [modifiedFiles, setModifiedFiles] = useState<Record<string, { original: string, current: string }>>({});
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string>('');

  const [uploadLogs, setUploadLogs] = useState<string[]>([]);
  const [showUploadConsole, setShowUploadConsole] = useState(false);
  const [consoleSize, setConsoleSize] = useState<ConsoleSize>('mid');
  
  const logEndRef = useRef<HTMLDivElement>(null);

  const [lang, setLang] = useState('English');
  useEffect(() => {
    setLang(localStorage.getItem('ca_preferred_language') || 'English');
    const wasVisible = localStorage.getItem(CONSOLE_VISIBILITY_KEY) === 'true';
    if (wasVisible) setShowUploadConsole(true);
  }, []);

  const t = (key: string) => {
    const dict: Record<string, any> = {
      'repos': { English: 'Repos', Japanese: 'リポジトリ' },
      'editor': { English: 'Code', Japanese: 'コード' },
      'ai': { English: 'AI', Japanese: 'AI' },
      'server': { English: 'Server', Japanese: 'サーバー' },
      'activity': { English: 'History', Japanese: '履歴' },
      'hub': { English: 'MCP Hub', Japanese: 'ハブ' },
      'settings': { English: 'Vault', Japanese: '設定' },
      'console': { English: 'Console', Japanese: 'コンソール' },
    };
    return dict[key]?.[lang] || dict[key]?.English || key;
  };

  useEffect(() => {
    if (selectedRepo && !currentBranch) {
      setCurrentBranch(selectedRepo.default_branch || 'main');
    }
  }, [selectedRepo]);

  useEffect(() => {
    const handleOpenConsole = () => {
      setShowUploadConsole(true);
      localStorage.setItem(CONSOLE_VISIBILITY_KEY, 'true');
    };
    const handleUpdateLogs = () => {
      const savedLogs = localStorage.getItem(UPLOAD_LOGS_KEY);
      if (savedLogs) setUploadLogs(JSON.parse(savedLogs));
    };
    window.addEventListener('show-upload-console', handleOpenConsole);
    window.addEventListener('update-console-logs', handleUpdateLogs);
    return () => {
      window.removeEventListener('show-upload-console', handleOpenConsole);
      window.removeEventListener('update-console-logs', handleUpdateLogs);
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uploadLogs]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    logUserAction({ type: 'navigation', detail: `Switched to ${tab}` });
    if (tab !== 'ai') setAiInitialPrompt('');
  };

  const handleFileUpdate = (newContent: string) => {
    setFileContent(newContent);
    if (activeFile) {
      setModifiedFiles(prev => ({
        ...prev,
        [activeFile.path]: {
          original: prev[activeFile.path]?.original || fileContent,
          current: newContent
        }
      }));
    }
  };

  const handleMultiFileUpdate = (changes: { file: string, content: string }[]) => {
    setModifiedFiles(prev => {
      const next = { ...prev };
      changes.forEach(change => {
        if (activeFile && activeFile.path === change.file) setFileContent(change.content);
        next[change.file] = { original: next[change.file]?.original || change.content, current: change.content };
      });
      return next;
    });
  };

  const handleCommitSuccess = (path: string) => {
    setModifiedFiles(prev => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const handleFileSelect = (file: GitHubContent | null, content: string) => {
    setActiveFile(file);
    setFileContent(content);
    if (file && !modifiedFiles[file.path]) {
      setModifiedFiles(prev => ({ ...prev, [file.path]: { original: content, current: content } }));
    }
  };

  const handleRepoSelect = (repo: GitHubRepo) => {
    onRepoSelect(repo);
    setCurrentBranch(repo.default_branch || 'main');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'repos': return <RepoSelector token={token} onSelect={(repo) => { handleRepoSelect(repo); handleTabChange('ai'); }} />;
      case 'editor': return <EditorView token={token} repo={selectedRepo} activeFile={activeFile} fileContent={fileContent} modifiedFiles={modifiedFiles} currentBranch={currentBranch} onFileSelect={handleFileSelect} onFileUpdate={handleFileUpdate} onCommitSuccess={handleCommitSuccess} onBranchChange={setCurrentBranch} onRepoSelect={handleRepoSelect} isUploading={false} />;
      case 'ai': return <AIChatView token={token} repo={selectedRepo} activeFile={activeFile} fileContent={fileContent} currentBranch={currentBranch} initialPrompt={aiInitialPrompt} onFileUpdate={(newContent) => { handleFileUpdate(newContent); handleTabChange('editor'); }} onMultiFileUpdate={handleMultiFileUpdate} />;
      case 'server': return <SandboxView token={token} repo={selectedRepo} />;
      case 'activity': return <ActivityView token={token} repo={selectedRepo} onSolveWithAI={(issue) => { setAiInitialPrompt(`Solve Issue: #${issue.number} ${issue.title}`); setActiveTab('ai'); }} onReviewPRWithAI={(pr) => { setAiInitialPrompt(`Review PR: #${pr.number} ${pr.title}`); setActiveTab('ai'); }} onResumeAIAction={(activity) => { setAiInitialPrompt(`Resume context: ${activity.description}`); setActiveTab('ai'); }} />;
      case 'hub': return <IntegrationHubView onNavigateToSettings={() => handleTabChange('settings')} />;
      case 'settings': return <SettingsView onLogout={() => { localStorage.clear(); onLogout(); }} onNavigateToLegal={(p) => { setLegalPage(p); handleTabChange('legal'); }} />;
      case 'legal': return <LegalViews page={legalPage} onBack={() => handleTabChange('settings')} />;
      default: return null;
    }
  };

  const navItems = [
    { id: 'repos', label: t('repos'), icon: FolderGit2 },
    { id: 'editor', label: t('editor'), icon: Code2 },
    { id: 'ai', label: t('ai'), icon: Sparkles },
    { id: 'hub', label: t('hub'), icon: Boxes },
    { id: 'server', label: t('server'), icon: Server },
    { id: 'activity', label: t('activity'), icon: History },
    { id: 'settings', label: t('settings'), icon: Settings },
  ];

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden relative overscroll-none">
      <main className="flex-1 min-h-0 overflow-hidden relative w-full max-w-full">
        {renderContent()}
      </main>

      {showUploadConsole && (
        <div className={cn("absolute inset-x-0 bottom-20 bg-card border-t border-border shadow-2xl z-[100] flex flex-col transition-all duration-300", consoleSize === 'min' ? 'h-14' : consoleSize === 'mid' ? 'h-[40%]' : 'h-[85%]')}>
          <div className="h-12 bg-muted/90 flex items-center justify-between px-4 shrink-0 cursor-pointer" onClick={() => setConsoleSize(prev => prev === 'min' ? 'mid' : prev === 'mid' ? 'max' : 'min')}>
            <div className="flex items-center gap-3">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold uppercase text-foreground">{t('console')}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setShowUploadConsole(false); localStorage.setItem(CONSOLE_VISIBILITY_KEY, 'false'); }}><X className="w-4 h-4" /></Button>
          </div>
          {consoleSize !== 'min' && (
            <ScrollArea className="flex-1 bg-black/40">
              <div className="p-4 font-code text-[11px] space-y-1">
                {uploadLogs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="opacity-20 shrink-0">{(i+1).toString().padStart(3,'0')}</span>
                    <span className={cn("whitespace-pre-wrap", log.includes('❌') ? "text-red-400 font-bold" : log.includes('✅') ? "text-green-500 font-bold" : "text-foreground/70")}>{log}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      <GlobalAssistantChat currentTab={activeTab} />

      <nav className="h-20 shrink-0 border-t border-border flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] z-50 bg-card shadow-lg w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => handleTabChange(item.id as Tab)} className={cn("flex flex-col items-center gap-1 transition-all flex-1", isActive ? "text-primary scale-110" : "text-muted-foreground")}>
              <Icon className={cn("w-5 h-5", isActive && "drop-shadow-sm")} />
              <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}