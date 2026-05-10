"use client"

import React, { useState, useEffect } from 'react';
import { fetchRepos, createRepo, GitHubRepo, createCommit, fetchLatestDeployment } from '@/app/lib/github';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Search, Github, Plus, Loader2, Upload, FileArchive, ExternalLink, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from '@/lib/activity';
import JSZip from 'jszip';

interface RepoSelectorProps {
  token: string;
  onSelect: (repo: GitHubRepo) => void;
}

export function RepoSelector({ token, onSelect }: RepoSelectorProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoUrls, setRepoUrls] = useState<Record<string, string | null>>({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isZipImporting, setIsZipImporting] = useState(false);
  const { toast } = useToast();

  const [lang, setLang] = useState('English');
  useEffect(() => {
    setLang(localStorage.getItem('ca_preferred_language') || 'English');
  }, []);

  const t = (key: string) => {
    const dict: Record<string, any> = {
      'new_repo': { English: 'New Repo', Japanese: '新規作成' },
      'import_zip': { English: 'Import ZIP', Japanese: 'ZIPインポート' },
      'search': { English: 'Search repositories...', Japanese: 'リポジトリを検索...' },
      'no_repos': { English: 'No repositories found', Japanese: 'リポジトリが見つかりません' },
      'view_site': { English: 'View Site', Japanese: 'サイトを見る' }
    };
    return dict[key]?.[lang] || dict[key]?.English || key;
  };

  useEffect(() => {
    loadRepos();
  }, [token]);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const data = await fetchRepos(token);
      setRepos(data);
      
      // 非同期でデプロイURLを取得
      data.forEach(async (r) => {
        const url = await fetchLatestDeployment(token, r.full_name);
        setRepoUrls(prev => ({ ...prev, [r.full_name]: url }));
      });

    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load repositories." });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    setIsCreating(true);
    try {
      const repo = await createRepo(token, newRepoName, newRepoDesc, false);
      logActivity({ type: 'repo-create', description: `Created new repository: ${repo.name}`, repoName: repo.full_name });
      toast({ title: "Success", description: `Repository '${repo.name}' created!` });
      setIsDialogOpen(false);
      setNewRepoName('');
      setNewRepoDesc('');
      loadRepos();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsCreating(false);
    }
  };

  const autonomousSanitizePath = (rawPath: string) => {
    return rawPath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .replace(/\/+/g, '/')
      .trim();
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsZipImporting(true);
    window.dispatchEvent(new CustomEvent('show-upload-console'));
    
    const dispatchLog = (msg: string) => {
      const currentLogs = JSON.parse(localStorage.getItem('cursor_app_upload_logs') || '[]');
      const newLogs = [...currentLogs, `[${new Date().toLocaleTimeString()}] ${msg}`];
      localStorage.setItem('cursor_app_upload_logs', JSON.stringify(newLogs));
      window.dispatchEvent(new CustomEvent('update-console-logs'));
    };

    try {
      dispatchLog(`📦 Initializing Autonomous ZIP Import for: ${file.name}`);
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(file);
      const repoName = file.name.replace('.zip', '').replace(/[^a-zA-Z0-9-_]/g, '-');
      
      dispatchLog(`🚀 Creating GitHub repository: ${repoName}...`);
      const repo = await createRepo(token, repoName, "Imported from ZIP via Cursor-App AI Engine", false);
      
      const filesToUpload = Object.keys(zipContents.files).filter(path => !zipContents.files[path].dir);
      const totalFiles = filesToUpload.length;
      dispatchLog(`📂 Found ${totalFiles} files to batch push.`);
      
      for (let i = 0; i < totalFiles; i++) {
        const rawPath = filesToUpload[i];
        const path = autonomousSanitizePath(rawPath);
        if (path !== rawPath) dispatchLog(`🤖 AI Autonomous Correction: Sanitized '${rawPath}' to '${path}'`);
        if (!path || path.startsWith('__MACOSX') || path.includes('.DS_Store')) continue;
        const fileContent = await zipContents.files[rawPath].async('string');
        dispatchLog(`⏳ [${i + 1}/${totalFiles}] Syncing: ${path}...`);
        await createCommit(token, repo.full_name, path, `Initial AI Import: ${path}`, fileContent);
        dispatchLog(`✅ Uploaded: ${path}`);
      }

      logActivity({ type: 'upload', description: `Successfully imported ZIP: ${repoName}`, repoName: repo.full_name });
      dispatchLog(`🎉 ZIP Import Successful! Repository ${repoName} is ready.`);
      toast({ title: "Import Successful", description: `All files pushed to '${repoName}'.` });
      loadRepos();
      onSelect(repo);
    } catch (err: any) {
      dispatchLog(`❌ IMPORT ERROR: ${err.message}`);
      toast({ variant: "destructive", title: "Import Failed", description: err.message });
    } finally {
      setIsZipImporting(false);
    }
  };

  const filteredRepos = repos.filter(r => 
    r.full_name.toLowerCase().includes(filter.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      <header className="p-6 border-b border-border bg-card/30 shrink-0">
        <div className="max-w-2xl mx-auto w-full space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Github className="text-primary w-6 h-6" />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <input type="file" accept=".zip" onChange={handleZipUpload} className="hidden" id="zip-upload-selector" disabled={isZipImporting} />
                <Button size="sm" variant="outline" className="rounded-full gap-2 border-primary/20" asChild disabled={isZipImporting}>
                  <label htmlFor="zip-upload-selector" className="cursor-pointer">
                    {isZipImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                    {t('import_zip')}
                  </label>
                </Button>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-full gap-2 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20">
                    <Plus className="w-4 h-4" />
                    {t('new_repo')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border text-foreground rounded-3xl">
                  <DialogHeader><DialogTitle>Create New Repository</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Repo Name</Label>
                      <Input id="name" value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} placeholder="my-awesome-project" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateRepo} disabled={!newRepoName || isCreating} className="w-full rounded-2xl h-12">
                      {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Repository"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={t('search')} value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-10 h-11 rounded-xl" />
          </div>
        </div>
      </header>
      <ScrollArea className="flex-1 w-full">
        <div className="p-6 space-y-4 max-w-2xl mx-auto pb-20 w-full">
          {loading ? (
            Array(5).fill(0).map((_, i) => <Card key={i} className="p-6 h-24 rounded-3xl animate-pulse" />)
          ) : filteredRepos.length > 0 ? (
            filteredRepos.map((repo) => (
              <div key={repo.id} className="relative group">
                <button onClick={() => onSelect(repo)} className="text-left w-full block overflow-hidden rounded-3xl">
                  <Card className="p-5 hover:border-primary/50 transition-all flex items-center rounded-3xl shadow-sm w-full border">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <img src={repo.owner.avatar_url} className="w-12 h-12 rounded-2xl shrink-0" alt={repo.owner.login} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] opacity-50 font-mono mb-0.5">{repo.owner.login}</div>
                        <h3 className="font-headline text-sm font-bold truncate">{repo.name}</h3>
                        <p className="text-[10px] opacity-60 truncate">{repo.description || "No description."}</p>
                      </div>
                    </div>
                  </Card>
                </button>
                {repoUrls[repo.full_name] && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full h-8 px-4 gap-2 text-[10px] font-bold uppercase tracking-wider shadow-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(repoUrls[repo.full_name]!, '_blank');
                    }}
                  >
                    <Globe className="w-3 h-3" />
                    {t('view_site')}
                  </Button>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-20 text-muted-foreground"><Search className="w-16 h-16 mx-auto mb-4 opacity-10" /><p>{t('no_repos')}</p></div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
