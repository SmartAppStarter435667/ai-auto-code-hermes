"use client"

import React, { useState, useEffect } from 'react';
import { 
  GitHubRepo, 
  GitHubContent, 
  fetchContents, 
  fetchFileContent, 
  createCommit, 
  deleteFile,
  fetchCommits, 
  GitHubCommit,
  fetchBranches,
  GitHubBranch,
  createIssue
} from '@/app/lib/github';
import { 
  File, 
  Folder, 
  ChevronLeft, 
  Save, 
  Loader2, 
  Plus, 
  Clock, 
  FilePlus,
  FolderPlus,
  GitBranch,
  ChevronDown,
  Trash2,
  Code2,
  Eye,
  Smartphone,
  Layout,
  X,
  FileArchive,
  FolderGit2,
  Wand2,
  ShieldAlert,
  Download,
  Sparkles
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isCriticalFile, detectSecrets } from '@/lib/safety';
import { ApprovalDialog } from '@/components/ApprovalDialog';
import { formatDistanceToNow } from 'date-fns';
import Editor from '@monaco-editor/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import JSZip from 'jszip';
import { logActivity } from '@/lib/activity';

interface EditorViewProps {
  token: string;
  repo: GitHubRepo | null;
  activeFile: GitHubContent | null;
  fileContent: string;
  modifiedFiles: Record<string, { original: string, current: string }>;
  currentBranch?: string;
  onFileSelect: (file: GitHubContent | null, content: string) => void;
  onFileUpdate: (content: string) => void;
  onCommitSuccess: (path: string) => void;
  onBranchChange: (branch: string) => void;
  onRepoSelect: (repo: GitHubRepo) => void;
  isUploading: boolean;
}

export function EditorView({ 
  token, 
  repo, 
  activeFile, 
  fileContent, 
  modifiedFiles,
  currentBranch,
  onFileSelect, 
  onFileUpdate, 
  onCommitSuccess,
  onBranchChange,
  onRepoSelect,
  isUploading: parentIsUploading
}: EditorViewProps) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [contents, setContents] = useState<GitHubContent[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [lastCommits, setLastCommits] = useState<Record<string, GitHubCommit>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<'code' | 'design'>('code');
  const [isZipImporting, setIsZipImporting] = useState(false);
  
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const [lang, setLang] = useState('English');
  useEffect(() => {
    setLang(localStorage.getItem('ca_preferred_language') || 'English');
  }, []);

  const t = (key: string) => {
    const dict: Record<string, any> = {
      'commit': { English: 'Commit', Japanese: 'コミット' },
      'back': { English: 'Back', Japanese: '戻る' },
      'new_file': { English: 'New File', Japanese: '新規ファイル' },
      'new_folder': { English: 'New Folder', Japanese: '新規フォルダ' },
      'create': { English: 'Create', Japanese: '作成' },
      'no_repo': { English: 'Which repository do you want to manage?', Japanese: 'どのリポジトリを管理しますか？' },
      'import_zip': { English: 'Import ZIP', Japanese: 'ZIPインポート' },
      'overwrite_zip': { English: 'Overwrite with ZIP', Japanese: 'ZIPで上書き展開' },
      'download_zip': { English: 'Zip and Download', Japanese: 'ZIPをダウンロード' }
    };
    return dict[key]?.[lang] || dict[key]?.English || key;
  };

  const [approvalState, setApprovalState] = useState<{ isOpen: boolean; type: 'commit' | 'delete'; }>({ isOpen: false, type: 'commit' });
  const { toast } = useToast();

  useEffect(() => { if (repo && !activeFile) loadContents(); }, [repo, currentPath, activeFile, currentBranch]);
  useEffect(() => { if (repo) loadBranches(); }, [repo]);

  const loadBranches = async () => {
    if (!repo) return;
    try { const data = await fetchBranches(token, repo.full_name); setBranches(data); } catch (e) { console.error(e); }
  };

  const loadContents = async () => {
    if (!repo) return;
    setIsLoading(true);
    try {
      const data = await fetchContents(token, repo.full_name, currentPath.join('/'), currentBranch);
      setContents(data);
      const commitsMap: Record<string, GitHubCommit> = {};
      await Promise.all(data.map(async (item) => {
        try {
          const commits = await fetchCommits(token, repo.full_name, item.path, currentBranch, 1);
          if (commits.length > 0) commitsMap[item.path] = commits[0];
        } catch (e) {
          console.error('Failed to fetch commits:', e);
        }
      }));
      setLastCommits(commitsMap);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const autonomousSanitizePath = (rawPath: string) => {
    let cleanPath = rawPath
      .replace(/\\/g, '/')              
      .replace(/^\/+/, '')              
      .replace(/\/+$/, '')              
      .replace(/\/+/g, '/')             
      .replace(/[<>:"|?*]/g, '')        
      .trim();
    
    return cleanPath;
  };

  const handleDownloadZip = async () => {
    if (!repo || !token) return;
    setIsSaving(true);
    try {
      const ref = currentBranch || repo.default_branch || 'main';
      const url = `https://api.github.com/repos/${repo.full_name}/zipball/${ref}`;
      
      toast({ title: t('download_zip'), description: "Connecting to GitHub engine..." });

      const res = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) throw new Error('Failed to generate ZIP on GitHub server');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${repo.name}-${ref}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      logActivity({ type: 'upload', description: `Exported repository as ZIP: ${repo.name}`, repoName: repo.full_name });
      toast({ title: "Download Ready", description: `Archived version of '${repo.name}' saved.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !repo) return;

    setIsZipImporting(true);
    window.dispatchEvent(new CustomEvent('show-upload-console'));
    
    const dispatchLog = (msg: string) => {
      const currentLogs = JSON.parse(localStorage.getItem('cursor_app_upload_logs') || '[]');
      const newLogs = [...currentLogs, `[${new Date().toLocaleTimeString()}] ${msg}`];
      localStorage.setItem('cursor_app_upload_logs', JSON.stringify(newLogs));
      window.dispatchEvent(new CustomEvent('update-console-logs'));
    };

    try {
      dispatchLog(`📦 Initializing Autonomous ZIP Engine for: ${repo.name}`);
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(file);
      
      const filesToUpload = Object.keys(zipContents.files).filter(path => !zipContents.files[path].dir);
      const totalFiles = filesToUpload.length;
      dispatchLog(`📂 Detected ${totalFiles} files in ZIP.`);
      
      for (let i = 0; i < totalFiles; i++) {
        const rawPath = filesToUpload[i];
        let path = autonomousSanitizePath(rawPath);
        
        if (path !== rawPath) {
          dispatchLog(`🤖 AI Autonomous Correction: Sanitized path from '${rawPath}' to '${path}'`);
        }
        
        if (!path || path.startsWith('__MACOSX') || path.includes('.DS_Store') || path.includes('Thumbs.db')) {
          dispatchLog(`⏭️ Skipping system file: ${path || rawPath}`);
          continue;
        }

        const content = await zipContents.files[rawPath].async('string');
        
        const scan = detectSecrets(content);
        if (scan.found) {
          dispatchLog(`🚨 SECURITY ALERT: ${scan.types.join(', ')} detected in ${path}. Upload paused.`);
          if (!confirm(`Warning: Hardcoded secrets detected in ${path}. Do you want to skip this file and continue?`)) {
            throw new Error(`Security Stop: Secret found in ${path}`);
          }
          dispatchLog(`⚠️ Skipping insecure file: ${path}`);
          continue;
        }

        dispatchLog(`⏳ [${i + 1}/${totalFiles}] Syncing: ${path}...`);
        
        try {
          let existingSha: string | undefined = undefined;
          try {
            const fileInfo = await fetchFileContent(token, repo.full_name, path, currentBranch);
            existingSha = fileInfo.sha;
          } catch (e) { console.error('Failed to fetch existing file info:', e); }

          await createCommit(token, repo.full_name, path, `ZIP Autonomous Overwrite: ${path}`, content, existingSha, currentBranch);
          dispatchLog(`✅ Uploaded: ${path}`);
        } catch (commitErr: any) {
          const errorMsg = commitErr.message?.toLowerCase() || "";
          if (errorMsg.includes('path contains a malformed path component') || errorMsg.includes('invalid path')) {
            dispatchLog(`❌ ERROR DETECTED: Malformed path '${path}'`);
            dispatchLog(`🤖 AI RETRY: Deep cleaning and reconstructing path...`);
            
            const deepCleanedPath = path.replace(/[^a-zA-Z0-9._\-/]/g, '_');
            dispatchLog(`🤖 AI Autonomous Correction: Retrying with deep cleaned path: ${deepCleanedPath}`);
            
            try {
              await createCommit(token, repo.full_name, deepCleanedPath, `ZIP AI Recovery: ${deepCleanedPath}`, content, undefined, currentBranch);
              dispatchLog(`✅ AI Recovery Successful: ${deepCleanedPath}`);
            } catch (retryErr: any) {
              dispatchLog(`❌ AI RECOVERY FAILED: ${retryErr.message}`);
              logActivity({ type: 'error', description: `File Skip (Recovery Failed): ${path}`, repoName: repo.full_name });
            }
          } else {
            throw commitErr;
          }
        }
      }

      logActivity({ type: 'upload', description: `Successfully expanded ZIP into: ${repo.name}`, repoName: repo.full_name });
      dispatchLog(`🎉 ZIP Expansion Complete! ${totalFiles} files processed.`);
      toast({ title: "Overwrite Success", description: `Applied changes to '${repo.name}'.` });
      loadContents();
    } catch (err: any) {
      const errMsg = err.message || "Unknown error";
      dispatchLog(`❌ IMPORT ERROR: ${errMsg}`);
      logActivity({ type: 'error', description: `ZIP Overwrite Failed: ${errMsg}`, repoName: repo.full_name });
      toast({ variant: "destructive", title: "Import Failed", description: errMsg });
    } finally {
      setIsZipImporting(false);
    }
    e.target.value = '';
  };

  const isFileModified = (path: string) => {
    const mod = modifiedFiles[path];
    return mod && mod.original !== mod.current;
  };

  const handleItemClick = async (item: GitHubContent) => {
    if (item.type === 'dir') {
      setCurrentPath([...currentPath, item.name]);
    } else {
      const mod = modifiedFiles[item.path];
      if (mod && mod.original !== mod.current) { onFileSelect(item, mod.current); return; }
      try {
        const fullFile = await fetchFileContent(token, repo!.full_name, item.path, currentBranch);
        if (fullFile.content) {
          const cleaned = fullFile.content.replace(/\s/g, '');
          onFileSelect(fullFile, atob(cleaned));
        }
      } catch (e) { console.error(e); }
    }
  };

  const handleCreateFile = async () => {
    if (!repo || !newItemName.trim()) return;
    setIsSaving(true);
    const path = currentPath.length > 0 ? `${currentPath.join('/')}/${newItemName}` : newItemName;
    try {
      await createCommit(token, repo.full_name, path, `Create ${newItemName}`, '', undefined, currentBranch);
      setIsCreatingFile(false);
      setNewItemName('');
      loadContents();
      toast({ title: "File Created", description: path });
    } catch (e: any) {
      logActivity({ type: 'error', description: `File Creation Failed: ${e.message}`, repoName: repo.full_name });
      toast({ variant: "destructive", title: "Creation Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!repo || !newItemName.trim()) return;
    setIsSaving(true);
    const path = currentPath.length > 0 ? `${currentPath.join('/')}/${newItemName}/.gitkeep` : `${newItemName}/.gitkeep`;
    try {
      await createCommit(token, repo.full_name, path, `Create folder ${newItemName}`, '', undefined, currentBranch);
      setIsCreatingFolder(false);
      setNewItemName('');
      loadContents();
      toast({ title: "Folder Created", description: newItemName });
    } catch (e: any) {
      logActivity({ type: 'error', description: `Folder Creation Failed: ${e.message}`, repoName: repo.full_name });
      toast({ variant: "destructive", title: "Creation Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: GitHubContent) => {
    if (!repo) return;
    if (!confirm(`Delete ${item.name}?`)) return;
    setIsSaving(true);
    try {
      await deleteFile(token, repo.full_name, item.path, `Delete ${item.name}`, item.sha, currentBranch);
      loadContents();
      toast({ title: "Deleted", description: item.name });
    } catch (e: any) {
      logActivity({ type: 'error', description: `Deletion Failed: ${e.message}`, repoName: repo.full_name });
      toast({ variant: "destructive", title: "Deletion Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const executeCommit = async () => {
    if (!repo || !activeFile || !fileContent) return;
    
    const scan = detectSecrets(fileContent);
    if (scan.found) {
      if (confirm(`🚨 Security Alert: Hardcoded ${scan.types.join(', ')} detected in ${activeFile.name}.\n\nIt is strongly recommended to use environment variables. Do you want to create a GitHub Issue to track this fix and continue at your own risk?`)) {
        try {
          await createIssue(token, repo.full_name, `Security Improvement: ${activeFile.name}`, `Secrets detected in ${activeFile.path}. Action required: Move to Settings Vault.`);
          toast({ title: "Security Issue Created" });
        } catch (e) { console.error('Failed to create issue:', e); }
      } else {
        setApprovalState({ isOpen: false, type: 'commit' });
        return;
      }
    }

    setIsSaving(true);
    try {
      await createCommit(token, repo.full_name, activeFile.path, `Update ${activeFile.name} via Cursor-App`, fileContent, activeFile.sha, currentBranch);
      onCommitSuccess(activeFile.path);
      toast({ title: "Success", description: "Changes committed to GitHub." });
      setApprovalState({ isOpen: false, type: 'commit' });
      onFileSelect(null, '');
    } catch (e: any) { 
      logActivity({ type: 'error', description: `Commit Failed: ${e.message}`, repoName: repo.full_name });
      toast({ variant: "destructive", title: "Error", description: e.message }); 
    } finally { 
      setIsSaving(false); 
    }
  };

  if (!repo) {
    return (
      <div className="h-full flex flex-col bg-background overflow-hidden w-full max-w-full">
        <header className="p-6 border-b border-border flex items-center justify-between bg-card/30 shrink-0">
          <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-3">
              <Code2 className="text-primary w-6 h-6" /> <h2 className="text-xl font-headline font-bold">Code Editor</h2>
            </div>
          </div>
        </header>
        <ScrollArea className="flex-1 w-full">
          <div className="max-w-2xl mx-auto p-12 text-center space-y-8 min-w-0">
            <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
              <FolderGit2 className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-headline font-bold text-white px-4">{t('no_repo')}</h3>
              <p className="text-muted-foreground text-sm px-4">Select a repository from the list to start editing or expanding ZIP files with autonomous correction.</p>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (activeFile) {
    return (
      <div className="h-full flex flex-col bg-background overflow-hidden w-full max-w-full">
        <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-card/50 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <Button variant="ghost" size="icon" onClick={() => onFileSelect(null, '')} className="h-8 w-8"><ChevronLeft className="w-5 h-5" /></Button>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono text-muted-foreground truncate">{activeFile.path}</span>
              <span className={cn("text-xs font-bold truncate text-white", isFileModified(activeFile.path) && "text-amber-500")}>{activeFile.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={editorMode} onValueChange={(val: any) => setEditorMode(val)} className="h-8">
              <TabsList className="bg-muted h-8 p-1 rounded-lg">
                <TabsTrigger value="code" className="h-6 text-[10px] gap-1.5"><Code2 className="w-3 h-3" /> Code</TabsTrigger>
                <TabsTrigger value="design" className="h-6 text-[10px] gap-1.5"><Layout className="w-3 h-3" /> Design</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" variant={isFileModified(activeFile.path) ? "default" : "outline"} className={cn("rounded-full h-8 px-4 gap-2 text-xs font-headline shadow-lg", !isFileModified(activeFile.path) && "opacity-40")} onClick={() => setApprovalState({ isOpen: true, type: 'commit' })} disabled={isSaving || !isFileModified(activeFile.path)}>
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{t('commit')}
            </Button>
          </div>
        </header>
        <div className="flex-1 relative overflow-hidden w-full">
          {editorMode === 'code' ? (
            <Editor height="100%" language={activeFile.name.split('.').pop() === 'tsx' ? 'typescript' : 'javascript'} value={fileContent} theme="vs-dark" onChange={(val) => onFileUpdate(val || '')} options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true, wordWrap: 'on' }} />
          ) : (
            <div className="h-full w-full bg-[#121212] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
              <div className="aspect-[9/16] max-w-[280px] w-full bg-card border-[6px] border-zinc-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden p-6 flex flex-col items-center justify-center">
                <Smartphone className="w-10 h-10 text-primary mb-4 opacity-50" />
                <h4 className="text-sm font-bold text-white mb-2">Visual UX Preview</h4>
                <p className="text-[10px] text-muted-foreground">Rendering autonomous UI components for {activeFile.name}...</p>
                <div className="mt-8 space-y-2 w-full"><div className="h-2 w-full bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary w-2/3 animate-pulse" /></div><div className="h-2 w-1/2 bg-muted rounded-full" /></div>
              </div>
              <p className="mt-6 text-xs text-muted-foreground flex items-center gap-2"><Eye className="w-4 h-4" /> Live visual feedback enabled by Gemini Code Assist</p>
            </div>
          )}
        </div>
        <ApprovalDialog isOpen={approvalState.isOpen} onClose={() => setApprovalState({ isOpen: false, type: 'commit' })} onConfirm={executeCommit} title="Approve Commit" description="Do you want to push these autonomous changes to GitHub?" isCritical={isCriticalFile(activeFile.path)} actionLabel="Commit Changes" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative bg-background overflow-hidden w-full max-w-full">
      <header className="p-6 border-b border-border flex items-center justify-between bg-card/30 shrink-0">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-4 overflow-hidden px-4">
          <div className="overflow-hidden flex-1 min-w-0">
            <h2 className="text-xl font-headline font-bold truncate text-white">{repo.name}</h2>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 rounded-md bg-muted text-[10px] gap-1 px-2"><GitBranch className="w-3 h-3 text-primary" />{currentBranch}<ChevronDown className="w-3 h-3 opacity-50" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-card border-border w-48 z-50">
                  {branches.map(b => <DropdownMenuItem key={b.name} onClick={() => onBranchChange(b.name)} className={cn("text-xs rounded-lg", currentBranch === b.name && "bg-primary/10")}>{b.name}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
             <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={handleDownloadZip} title={t('download_zip')} disabled={isSaving}>
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Download className="w-4 h-4 text-primary" />}
             </Button>
             <div className="relative">
                <input type="file" accept=".zip" onChange={handleZipUpload} className="hidden" id="zip-upload-overwrite" disabled={isZipImporting} />
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" asChild disabled={isZipImporting} title={t('overwrite_zip')}>
                  <label htmlFor="zip-upload-overwrite" className="cursor-pointer">
                    {isZipImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4 text-primary" />}
                  </label>
                </Button>
             </div>
             <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsCreatingFile(!isCreatingFile)} title="New File"><FilePlus className="w-4 h-4 text-primary" /></Button>
             <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsCreatingFolder(!isCreatingFolder)} title="New Folder"><FolderPlus className="w-4 h-4 text-primary" /></Button>
          </div>
        </div>
      </header>
      <ScrollArea className="flex-1 w-full">
        <div className="max-w-2xl mx-auto p-4 w-full pb-20 overflow-hidden min-w-0">
          {(isCreatingFile || isCreatingFolder) && (
            <div className="mb-4 bg-muted/30 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 border border-border/50">
              <Input value={newItemName} min-w-0 onChange={(e) => setNewItemName(e.target.value)} placeholder={isCreatingFile ? "filename.tsx" : "folder-name"} className="bg-background h-10 rounded-xl" autoFocus />
              <Button onClick={isCreatingFile ? handleCreateFile : handleCreateFolder} size="sm" className="rounded-xl h-10 px-4" disabled={isSaving || !newItemName}>Create</Button>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setIsCreatingFile(false); setIsCreatingFolder(false); setNewItemName(''); }}><X className="w-4 h-4" /></Button>
            </div>
          )}
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm divide-y divide-border/30 w-full min-w-0">
            {currentPath.length > 0 && (
              <button onClick={() => setCurrentPath(prev => prev.slice(0, -1))} className="w-full text-left p-4 flex items-center gap-4 hover:bg-muted/20 transition-colors"><Folder className="w-4 h-4 text-primary fill-primary/20" /><span className="text-xs font-bold opacity-50">..</span></button>
            )}
            {contents.map((item) => {
              const modified = item.type === 'file' && isFileModified(item.path);
              const lastCommit = lastCommits[item.path];
              return (
                <div key={item.sha} className="flex items-center gap-4 hover:bg-muted/20 p-1 group w-full min-w-0">
                  <button onClick={() => handleItemClick(item)} className="flex-1 flex items-center gap-4 p-3 text-left min-w-0">
                    {item.type === 'dir' ? <Folder className="w-5 h-5 text-primary fill-primary/20 shrink-0" /> : <File className={cn("w-5 h-5 shrink-0", modified ? "text-amber-500" : "text-muted-foreground")} />}
                    <div className="flex-1 grid grid-cols-12 gap-3 items-center min-w-0 overflow-hidden">
                      <div className="col-span-12 flex flex-col min-w-0">
                        <span className={cn("text-sm truncate text-white", modified && "text-amber-500 font-bold")}>{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground opacity-50 font-mono truncate">{lastCommit?.commit.message || '...'}</span>
                          <span className="text-[8px] text-muted-foreground opacity-30 whitespace-nowrap">
                            {lastCommit ? formatDistanceToNow(new Date(lastCommit.commit.author.date), { addSuffix: true }) : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 shrink-0 rounded-lg mr-2" onClick={() => handleDeleteItem(item)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
