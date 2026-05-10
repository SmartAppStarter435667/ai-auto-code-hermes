
"use client"

import React, { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { AuthScreen } from '@/components/AuthScreen';
import { GitHubLogin } from '@/components/GitHubLogin';
import { Workspace } from '@/components/Workspace';
import { GitHubRepo } from '@/app/lib/github';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading: authLoading } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('gh_token');
    if (storedToken) {
      setToken(storedToken);
    }
    setIsLoaded(true);
  }, []);

  const handleGitHubLogin = (newToken: string) => {
    localStorage.setItem('gh_token', newToken);
    setToken(newToken);
  };

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  /**
   * NOTE: Temporarily bypassing Firebase Authentication step due to API Key issues.
   * Proceeding directly to GitHub Token authentication.
   * 
   * To re-enable Firebase Auth, uncomment the following block:
   * 
   * if (!user && !authLoading) {
   *   return <AuthScreen />;
   * }
   */

  // Step 2: GitHub Token Authentication
  if (!token) {
    return <GitHubLogin onLogin={handleGitHubLogin} />;
  }

  // Step 3: Main Workspace
  return (
    <Workspace 
      token={token} 
      selectedRepo={selectedRepo}
      onRepoSelect={setSelectedRepo}
      onLogout={() => {
        localStorage.removeItem('gh_token');
        setToken(null);
        setSelectedRepo(null);
      }}
    />
  );
}
