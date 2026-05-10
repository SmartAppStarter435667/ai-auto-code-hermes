"use client"

import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ShieldCheck, FileText, Building2, Globe, ExternalLink } from 'lucide-react';

interface LegalViewProps {
  onBack: () => void;
  page: 'tos' | 'privacy' | 'corporate';
}

export function LegalViews({ onBack, page }: LegalViewProps) {
  const content = {
    tos: {
      title: "Terms of Service",
      icon: <FileText className="w-10 h-10 text-primary" />,
      body: `
### 1. Acceptance of Terms
By accessing Cursor-App, you agree to these terms.

### 2. Autonomous Agent Use
Our AI agents autonomously modify your GitHub repositories based on your natural language instructions. You are responsible for reviewing all changes before deployment.

### 3. Subscription & Billing
Tiered subscriptions provide varying levels of AI reasoning depth and build resources. Usage-based charges may apply beyond plan limits.

### 4. Liability
Cursor-App is provided "as is". We are not liable for autonomous code errors or cloud resource costs incurred by generated logic.
      `
    },
    privacy: {
      title: "Privacy Policy",
      icon: <ShieldCheck className="w-10 h-10 text-green-500" />,
      body: `
### 1. Data Encryption
Your GitHub Personal Access Tokens and Google API Keys are stored locally in your browser's secure storage.

### 2. Code Processing
We do not store your source code on our servers. Processing occurs via direct API calls to GitHub and Google AI Studio.

### 3. Usage Analytics
We collect anonymized usage data to optimize our AI pipeline performance.
      `
    },
    corporate: {
      title: "Corporate & Agency Services",
      icon: <Building2 className="w-10 h-10 text-amber-500" />,
      body: `
### Enterprise Autonomous Development
Cursor-App offers specialized agency white-labeling and enterprise-grade deployment pipelines.

### Professional Features:
- **Team Collaboration**: Manage multiple developers and shared AI contexts.
- **Priority Build Forge**: Dedicated 16GiB build nodes for complex applications.
- **Custom AI Fine-tuning**: Agents trained on your specific coding standards.

Contact our sales team for custom licensing.
      `
    }
  };

  const active = content[page];

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="h-16 border-b border-border flex items-center px-4 gap-4 bg-card/30">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full"><ChevronLeft /></Button>
        <h2 className="text-sm font-headline font-bold uppercase tracking-widest">{active.title}</h2>
      </header>
      <ScrollArea className="flex-1">
        <div className="p-8 max-w-2xl mx-auto space-y-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 bg-muted rounded-[2rem] flex items-center justify-center shadow-inner">
              {active.icon}
            </div>
            <h1 className="text-3xl font-headline font-bold">{active.title}</h1>
          </div>
          <div className="prose prose-sm prose-invert max-w-none bg-card border border-border p-8 rounded-[2.5rem] shadow-sm leading-relaxed whitespace-pre-wrap">
            {active.body}
          </div>
          {page === 'corporate' && (
            <div className="flex flex-col gap-3">
              <Button className="h-14 rounded-2xl gap-2 font-headline" asChild>
                <a href="https://example.com/contact" target="_blank" rel="noopener noreferrer">Contact Sales Team <Globe className="w-4 h-4" /></a>
              </Button>
              <Button variant="outline" className="h-14 rounded-2xl gap-2 font-headline" asChild>
                <a href="https://example.com/demo" target="_blank" rel="noopener noreferrer">Book a Professional Demo <ExternalLink className="w-4 h-4" /></a>
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
