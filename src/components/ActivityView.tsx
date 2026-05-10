"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { getActivities, Activity, clearActivities, getPipelineState, PipelineState, PipelineStep, clearPipelineState, savePipelineState } from '@/lib/activity';
import { 
  GitHubRepo, 
  fetchIssues, 
  fetchPullRequests, 
  fetchCommits, 
  fetchCommitDetails,
  fetchFileContent,
  createCommit,
  fetchWorkflowRuns,
  GitHubIssue, 
  GitHubPullRequest, 
  GitHubCommit,
  GitHubWorkflowRun
} from '@/app/lib/github';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  History, 
  Trash2, 
  Upload, 
  Save, 
  Sparkles, 
  FolderGit2, 
  Plus, 
  FileCode,
  Clock,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  GitPullRequest,
  Loader2,
  ExternalLink,
  Zap,
  CheckCircle2,
  Circle,
  GitCommit,
  AlertTriangle,
  Check,
  RotateCcw,
  X,
  Wand2,
  Flag,
  Play,
  Undo2,
  Activity as ActivityIcon,
  Server,
  LayoutDashboard,
  BarChart3,
  Cpu,
  ShieldCheck,
  TrendingUp,
  Box,
  Users,
  MessageSquare
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

interface ActivityViewProps {
  token?: string;
  repo?: GitHubRepo | null;
  onSolveWithAI?: (issue: GitHubIssue) => void;
  onReviewPRWithAI?: (pr: GitHubPullRequest) => void;
  onSolvePipelineWithAI?: (pipeline: PipelineState) => void;
  onResumeAIAction?: (activity: Activity) => void;
}

export function ActivityView({ token, repo, onSolveWithAI, onReviewPRWithAI, onSolvePipelineWithAI, onResumeAIAction }: ActivityViewProps) {
  const [localActivities, setLocalActivities] = useState<Activity[]>([]);
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<GitHubWorkflowRun[]>([]);
  const [isLoadingGitHub, setIsLoadingGitHub] = useState(false);
  const [isReverting, setIsReverting] = useState<string | null>(null);

  const { toast } = useToast();
  const [lang, setLang] = useState('English');
  useEffect(() => { setLang(localStorage.getItem('ca_preferred_language') || 'English'); }, []);

  const t = (key: string) => {
    const dict: Record<string, any> = {
      'title': { English: 'Global Pulse', Japanese: '管理ダッシュボード' },
      'app_activity': { English: 'Activity', Japanese: 'アプリ活動' },
      'github_feed': { English: 'GitHub Feed', Japanese: 'GitHub フィード' },
      'admin_hub': { English: 'Admin Hub', Japanese: '管理者' },
      'ai_pipeline': { English: 'AI Pipeline', Japanese: 'AI パイプライン' },
      'solve_with_ai': { English: 'AI Solve', Japanese: 'AIで解決' },
      'review_with_ai': { English: 'AI Review', Japanese: 'AIレビュー' },
      'issues': { English: 'Issues', Japanese: 'イシュー' },
      'pull_requests': { English: 'Pull Requests', Japanese: 'プルリクエスト' },
      'recent_commits': { English: 'Recent Commits', Japanese: '最新コミット' },
      'revert': { English: 'Revert', Japanese: '元に戻す' },
      'resume': { English: 'Resume Context', Japanese: '文脈を復元' },
    };
    return dict[key]?.[lang] || dict[key]?.English || key;
  };

  useEffect(() => {
    setLocalActivities(getActivities());
    setPipeline(getPipelineState());
    const interval = setInterval(() => { setPipeline(getPipelineState()); setLocalActivities(getActivities()); }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if (token && repo) loadGitHubData(); }, [token, repo]);

  const loadGitHubData = async () => {
    if (!token || !repo) return;
    setIsLoadingGitHub(true);
    try {
      const [issuesData, prsData, commitsData, workflowsData] = await Promise.all([
        fetchIssues(token, repo.full_name),
        fetchPullRequests(token, repo.full_name),
        fetchCommits(token, repo.full_name, '', undefined, 10),
        fetchWorkflowRuns(token, repo.full_name)
      ]);
      setIssues(issuesData);
      setPullRequests(prsData);
      setCommits(commitsData);
      setWorkflowRuns(workflowsData);
    } catch (e) { console.error(e); } finally { setIsLoadingGitHub(false); }
  };

  const handleRevertCommit = async (commit: GitHubCommit) => {
    if (!token || !repo) return;
    if (!confirm(`Revert commit ${commit.sha.substring(0, 7)}?`)) return;
    setIsReverting(commit.sha);
    try {
      const details = await fetchCommitDetails(token, repo.full_name, commit.sha);
      const parentSha = details.parents[0].sha;
      for (const file of details.files) {
        try {
          const oldFile = await fetchFileContent(token, repo.full_name, file.filename, parentSha);
          const oldContent = atob(oldFile.content!.replace(/\s/g, ''));
          await createCommit(token, repo.full_name, file.filename, `Revert: ${commit.commit.message}`, oldContent, undefined, repo.default_branch);
        } catch (fileErr) { console.error('Failed to revert file:', fileErr); }
      }
      toast({ title: "Revert Success" });
      loadGitHubData();
    } catch (e: any) { toast({ variant: "destructive", title: "Revert Failed", description: e.message }); } finally { setIsReverting(null); }
  };

  // Admin Hub Calculations
  const stats = useMemo(() => {
    const aiActions = localActivities.filter(a => a.type === 'ai').length;
    const uniqueRepos = new Set(localActivities.filter(a => a.repoName).map(a => a.repoName)).size;
    const errors = localActivities.filter(a => a.type === 'error').length;
    
    // Group by Repo
    const repoSummary: Record<string, { count: number, lastAction: string, lastTime: number }> = {};
    localActivities.forEach(a => {
      if (a.repoName) {
        if (!repoSummary[a.repoName]) {
          repoSummary[a.repoName] = { count: 0, lastAction: a.description, lastTime: a.timestamp };
        }
        repoSummary[a.repoName].count++;
        if (a.timestamp > repoSummary[a.repoName].lastTime) {
          repoSummary[a.repoName].lastAction = a.description;
          repoSummary[a.repoName].lastTime = a.timestamp;
        }
      }
    });

    return { aiActions, uniqueRepos, errors, repoSummary: Object.entries(repoSummary) };
  }, [localActivities]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'upload': return <Upload className="w-4 h-4 text-blue-400" />;
      case 'commit': return <Save className="w-4 h-4 text-green-400" />;
      case 'ai': return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'repo-create': return <Plus className="w-4 h-4 text-primary" />;
      case 'file-create': return <FileCode className="w-4 h-4 text-cyan-400" />;
      case 'milestone-create': return <Flag className="w-4 h-4 text-purple-500" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden w-full max-w-full">
      <header className="p-6 border-b border-border bg-card/30 shrink-0 w-full">
        <div className="max-w-2xl mx-auto flex items-center justify-between w-full px-4">
          <h2 className="text-xl font-headline font-bold flex items-center gap-3 truncate text-foreground">
            <LayoutDashboard className="text-primary w-6 h-6 shrink-0" />
            {t('title')}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => { if(confirm('Clear history?')){clearActivities(); setLocalActivities([]); setPipeline(null);}}} className="rounded-full text-muted-foreground hover:text-red-400 shrink-0">
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <Tabs defaultValue="admin" className="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
        <div className="bg-card/20 border-b border-border w-full shrink-0">
          <div className="max-w-2xl mx-auto w-full px-6 py-2">
            <TabsList className="bg-muted w-full rounded-xl h-10 p-1">
              <TabsTrigger value="admin" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-widest gap-2">
                <ShieldCheck className="w-3 h-3" /> {t('admin_hub')}
              </TabsTrigger>
              <TabsTrigger value="app" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-widest gap-2">
                <History className="w-3 h-3" /> {t('app_activity')}
              </TabsTrigger>
              <TabsTrigger value="github" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-widest gap-2">
                <ActivityIcon className="w-3 h-3" /> {t('github_feed')}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="admin" className="flex-1 m-0 overflow-hidden w-full">
          <ScrollArea className="h-full w-full">
            <div className="p-6 space-y-8 max-w-2xl mx-auto pb-20 w-full min-w-0">
              {/* High-Level Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-primary/5 border-primary/20 rounded-[2rem] p-5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-bold text-primary tracking-widest">AI Tasks</span>
                    <Cpu className="w-4 h-4 text-primary opacity-50" />
                  </div>
                  <div className="text-3xl font-headline font-bold text-foreground">{stats.aiActions}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-500" /> Team Productivity +12%
                  </div>
                </Card>
                <Card className="bg-card/40 border-border rounded-[2rem] p-5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-widest">Active Projects</span>
                    <Box className="w-4 h-4 text-zinc-400 opacity-50" />
                  </div>
                  <div className="text-3xl font-headline font-bold text-foreground">{stats.uniqueRepos}</div>
                  <div className="text-[10px] text-muted-foreground italic">Managing team-scale dev</div>
                </Card>
              </div>

              {/* Resource Orchestration Visualization */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase text-muted-foreground px-2 flex items-center gap-2">
                  <BarChart3 className="w-3 h-3 text-primary" /> Resource Orchestration
                </h3>
                <Card className="bg-card border-border rounded-3xl p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase">
                        <span className="text-zinc-400">Team Token Usage</span>
                        <span className="text-primary">64%</span>
                      </div>
                      <Progress value={64} className="h-1.5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase">
                        <span className="text-zinc-400">Sandbox Build Forge</span>
                        <span className="text-cyan-400">28%</span>
                      </div>
                      <Progress value={28} className="h-1.5 bg-zinc-800" />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Team Pulse List */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase text-muted-foreground px-2 flex items-center gap-2">
                  <FolderGit2 className="w-3 h-3 text-primary" /> Managed Repositories
                </h3>
                <div className="space-y-3">
                  {stats.repoSummary.length > 0 ? stats.repoSummary.map(([name, data]) => (
                    <div key={name} className="bg-card/40 border border-border/50 rounded-2xl p-4 flex items-center justify-between group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                          <Box className="w-5 h-5 text-zinc-500 group-hover:text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground truncate">{name.split('/').pop()}</h4>
                          <p className="text-[10px] text-muted-foreground truncate">{data.lastAction}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                         <div className="text-[9px] font-mono font-bold text-primary uppercase tracking-tighter">{data.count} Tasks</div>
                         <div className="text-[8px] text-muted-foreground opacity-50">{formatDistanceToNow(data.lastTime, { addSuffix: true })}</div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 opacity-30 italic text-xs">No repository activity detected yet.</div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="app" className="flex-1 m-0 overflow-hidden w-full">
          <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-4 max-w-2xl mx-auto pb-20 w-full min-w-0">
              {pipeline && (
                <div className="bg-card border border-border rounded-[2rem] p-6 mb-6 shadow-md relative overflow-hidden w-full min-w-0">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
                  <div className="flex items-center justify-between mb-8 gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">{pipeline.type === 'milestone-flow' ? <Flag className="w-6 h-6 text-primary" /> : <Server className="w-6 h-6 text-primary" />}</div>
                      <div className="min-w-0"><h3 className="text-sm font-bold uppercase tracking-widest truncate text-foreground">{pipeline.type === 'milestone-flow' ? 'Milestone Flow' : t('ai_pipeline')}</h3><p className="text-[10px] text-muted-foreground font-mono truncate">{pipeline.repoName}</p></div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onSolvePipelineWithAI?.(pipeline)} className="h-7 text-[9px] gap-1.5 rounded-full border-primary/20 bg-primary/5 text-primary font-bold"><Wand2 className="w-3 h-3" /> {t('solve_with_ai')}</Button>
                  </div>
                  <div className="bg-muted/20 rounded-3xl border border-border/10 mb-6 py-4 flex flex-col items-center w-full">
                    {pipeline.steps.map((step, idx) => (
                      <div key={step.id} className="flex flex-col items-center w-full px-4 py-2">
                        <div className="flex items-center gap-3 w-full">
                          <div className={cn("w-8 h-8 rounded-full border-2 flex items-center justify-center", step.status === 'completed' ? "bg-green-500/20 border-green-500" : step.status === 'running' ? "bg-primary/20 border-primary animate-pulse" : "border-foreground/10 opacity-30")}>
                            {step.status === 'completed' ? <Check className="w-4 h-4 text-green-500" /> : step.status === 'running' ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Circle className="w-4 h-4 text-foreground/20" />}
                          </div>
                          <span className={cn("text-[10px] font-bold uppercase", step.status === 'completed' ? "text-green-500" : step.status === 'running' ? "text-primary" : "text-muted-foreground")}>{step.label}</span>
                        </div>
                        {idx < pipeline.steps.length - 1 && <div className="w-0.5 h-4 bg-foreground/5 my-1" />}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2"><div className="flex justify-between text-[10px] font-bold text-muted-foreground"><span>Progress</span><span>{pipeline.progress}%</span></div><Progress value={pipeline.progress} className="h-1.5" /></div>
                </div>
              )}
              {localActivities.length === 0 ? <div className="text-center py-20 opacity-20"><History className="w-16 h-16 mx-auto mb-4" /><p>No activity yet.</p></div> : 
                localActivities.map(activity => (
                  <div key={activity.id} className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4 w-full min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">{getIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold uppercase text-primary">{activity.type}</span><span className="text-[10px] text-muted-foreground">{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</span></div>
                      <p className="text-sm font-medium text-foreground break-words">{activity.description}</p>
                      <div className="flex items-center justify-between mt-2 gap-2">
                        {activity.repoName && <span className="text-[8px] font-mono text-muted-foreground uppercase truncate">[{activity.repoName.split('/').pop()}]</span>}
                        {activity.type === 'ai' && (
                          <Button variant="ghost" size="sm" onClick={() => onResumeAIAction?.(activity)} className="h-6 text-[8px] font-bold uppercase tracking-widest gap-1 text-primary hover:bg-primary/10 rounded-lg">
                            <RotateCcw className="w-2.5 h-2.5" /> {t('resume')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="github" className="flex-1 m-0 overflow-hidden w-full">
          <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-8 max-w-2xl mx-auto pb-20 w-full min-w-0">
              {!repo ? <div className="text-center py-20 opacity-20"><FolderGit2 className="w-16 h-16 mx-auto mb-4" /><p>Select a repository.</p></div> : isLoadingGitHub ? <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div> : (
                <div className="space-y-8 w-full min-w-0">
                  <div className="space-y-3 w-full min-w-0">
                    <h3 className="text-[10px] font-bold uppercase text-muted-foreground px-2 flex items-center gap-2"><ActivityIcon className="w-3 h-3 text-blue-500" />GitHub Actions</h3>
                    {workflowRuns.length > 0 ? workflowRuns.map(run => (
                      <div key={run.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 w-full min-w-0">
                        <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0", run.status === 'completed' ? (run.conclusion === 'success' ? "bg-green-500" : "bg-red-500") : "bg-amber-500 animate-pulse")} />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-foreground mb-1 truncate">{run.name}</h4>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground uppercase">{run.conclusion || run.status} • {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</span>
                            <a href={run.html_url} target="_blank" rel="noopener noreferrer" className="text-primary"><ExternalLink className="w-4 h-4" /></a>
                          </div>
                        </div>
                      </div>
                    )) : <p className="text-[10px] text-muted-foreground text-center py-4">No workflow runs detected.</p>}
                  </div>

                  <div className="space-y-3 w-full min-w-0">
                    <h3 className="text-[10px] font-bold uppercase text-muted-foreground px-2 flex items-center gap-2"><AlertTriangle className="w-3 h-3 text-amber-500" />{t('issues')} ({issues.length})</h3>
                    {issues.map(issue => (
                      <div key={issue.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 w-full min-w-0">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-foreground mb-1 truncate">{issue.title}</h4>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">#{issue.number} by {issue.user.login}</span>
                            <Button variant="outline" size="sm" onClick={() => onSolveWithAI?.(issue)} className="h-7 text-[9px] gap-1.5 rounded-full border-primary/20 bg-primary/5 text-primary font-bold">
                               <Sparkles className="w-3 h-3" /> {t('solve_with_ai')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 w-full min-w-0">
                    <h3 className="text-[10px] font-bold uppercase text-muted-foreground px-2 flex items-center gap-2"><GitPullRequest className="w-3 h-3 text-primary" />{t('pull_requests')} ({pullRequests.length})</h3>
                    {pullRequests.map(pr => (
                      <div key={pr.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 w-full min-w-0">
                        <GitPullRequest className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-foreground mb-1 truncate">{pr.title}</h4>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">#{pr.number} by {pr.user.login}</span>
                            <Button variant="outline" size="sm" onClick={() => onReviewPRWithAI?.(pr)} className="h-7 text-[9px] gap-1.5 rounded-full border-purple-500/20 bg-purple-500/5 text-purple-500 font-bold">
                               <Sparkles className="w-3 h-3" /> {t('review_with_ai')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 w-full min-w-0">
                    <h3 className="text-[10px] font-bold uppercase text-muted-foreground px-2 flex items-center gap-2"><GitCommit className="w-3 h-3 text-green-500" />{t('recent_commits')}</h3>
                    {commits.map(commit => (
                      <div key={commit.sha} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 w-full min-w-0">
                        <GitCommit className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-foreground mb-1 break-words">{commit.commit.message}</h4>
                          <div className="flex justify-between items-center"><span className="text-[10px] text-muted-foreground">{commit.sha.substring(0, 7)} • {formatDistanceToNow(new Date(commit.commit.author.date), { addSuffix: true })}</span><Button variant="outline" size="sm" className="h-7 text-[9px] gap-1 rounded-full border-red-500/20 text-red-500 font-bold" onClick={() => handleRevertCommit(commit)} disabled={isReverting === commit.sha}>{isReverting === commit.sha ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} {t('revert')}</Button></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}