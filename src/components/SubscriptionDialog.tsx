"use client"

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Zap, Building2, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { ScrollArea } from "@/components/ui/scroll-area";

interface Plan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  price: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  buttonText: string;
  color: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Starter',
    price: '$0',
    description: 'Perfect for exploring AI coding',
    features: [
      '5,000 AI Tokens / mo',
      '60 Build Minutes / mo',
      '4GiB Sandbox Node',
      'Standard AI Agents'
    ],
    icon: <Zap className="w-5 h-5 text-zinc-400" />,
    buttonText: 'Current Plan',
    color: 'bg-zinc-500/10 border-zinc-500/20'
  },
  {
    id: 'pro',
    name: 'Pro Assist',
    price: '$29',
    description: 'Full autonomous development power',
    features: [
      '50,000 AI Tokens / mo',
      '300 Build Minutes / mo',
      '8GiB Priority Sandbox',
      'Gemini Code Assist (Full)',
      'Autonomous Debugging'
    ],
    icon: <Sparkles className="w-5 h-5 text-primary" />,
    buttonText: 'Upgrade to Pro',
    color: 'bg-primary/10 border-primary/20 ring-1 ring-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.1)]'
  },
  {
    id: 'enterprise',
    name: 'Enterprise Agency',
    price: 'Custom',
    description: 'Scaling for software agencies',
    features: [
      'Unlimited AI Tokens',
      'Priority Build Forge (16GiB)',
      'Custom AI Fine-tuning',
      'White-label Sandbox Preview',
      '24/7 Dedicated Support'
    ],
    icon: <Building2 className="w-5 h-5 text-amber-500" />,
    buttonText: 'Contact for Enterprise',
    color: 'bg-amber-500/10 border-amber-500/20'
  }
];

interface SubscriptionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier: string;
  userId: string;
}

export function SubscriptionDialog({ isOpen, onOpenChange, currentTier, userId }: SubscriptionDialogProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const db = useFirestore();
  const { toast } = useToast();

  const handleUpgrade = async (planId: string) => {
    if (planId === currentTier) return;
    if (planId === 'enterprise') {
      window.open('/corporate', '_blank');
      return;
    }

    setIsLoading(planId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        subscriptionTier: planId,
        maxTokens: planId === 'pro' ? 50000 : 5000,
        maxBuildMinutes: planId === 'pro' ? 300 : 60
      });

      toast({
        title: "Subscription Updated",
        description: `Successfully upgraded to ${planId.toUpperCase()} plan!`,
      });
      setTimeout(() => onOpenChange(false), 500);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Upgrade Failed",
        description: e.message
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] bg-card border-border rounded-3xl p-0 overflow-hidden flex flex-col">
        <div className="p-8 pb-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl sm:text-3xl font-headline font-bold text-center">Choose Your Coding Power</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-sm">
              Upgrade to unlock the full potential of Gemini Code Assist and high-performance Sandbox builds.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {PLANS.map((plan) => (
              <div 
                key={plan.id} 
                className={cn(
                  "rounded-3xl border p-6 flex flex-col gap-6 transition-all duration-300 relative",
                  plan.color,
                  plan.id === currentTier && "opacity-80"
                )}
              >
                {plan.id === 'pro' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                    Recommended
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-background/50 flex items-center justify-center shadow-inner">
                    {plan.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{plan.name}</span>
                    <span className="text-[10px] opacity-60 uppercase tracking-tighter">Plan Level</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-headline font-bold">{plan.price}</span>
                    {plan.id !== 'enterprise' && <span className="text-xs text-muted-foreground">/ month</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                </div>

                <div className="space-y-3 flex-1">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="opacity-80">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={plan.id === currentTier || !!isLoading}
                  variant={plan.id === currentTier ? "ghost" : plan.id === 'pro' ? "default" : "outline"}
                  className={cn(
                    "w-full rounded-2xl h-11 font-headline font-bold text-xs shadow-sm",
                    plan.id === 'pro' && "shadow-lg shadow-primary/20"
                  )}
                >
                  {isLoading === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : plan.buttonText}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="bg-muted/30 p-6 border-t border-border flex flex-wrap justify-center gap-6 shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
             <Check className="w-3 h-3 text-primary" /> Secure Payment
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
             <Check className="w-3 h-3 text-primary" /> Cancel Anytime
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
             <Check className="w-3 h-3 text-primary" /> 256-bit Encryption
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
