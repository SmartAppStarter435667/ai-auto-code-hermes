
"use client"

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isCritical?: boolean;
  actionLabel?: React.ReactNode;
  cancelLabel?: string;
}

export function ApprovalDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isCritical = false,
  actionLabel = "Confirm Action",
  cancelLabel = "Back"
}: ApprovalDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className={cn(
        "bg-[#1a1a1a] border-white/10 rounded-3xl max-w-md",
        isCritical && "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
      )}>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              isCritical ? "bg-red-500/20 text-red-500" : "bg-amber-500/20 text-amber-500"
            )}>
              {isCritical ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <AlertDialogTitle className="text-xl font-headline text-white">
              {isCritical ? "Critical Approval Required" : title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {isCritical && (
              <span className="block mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-bold text-xs uppercase tracking-widest">
                Warning: This affects a critical system file.
              </span>
            )}
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className={cn(
              "rounded-2xl h-12 font-headline shadow-lg transition-all w-full sm:flex-1",
              isCritical ? "bg-red-600 hover:bg-red-500 text-white" : "bg-primary hover:bg-primary/90 text-white"
            )}
          >
            {typeof actionLabel === 'string' ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {actionLabel}
              </>
            ) : actionLabel}
          </AlertDialogAction>
          <AlertDialogCancel className="rounded-2xl h-12 border-white/10 bg-white/5 hover:bg-white/10 text-white w-full sm:flex-1 mt-0">
            {cancelLabel}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
