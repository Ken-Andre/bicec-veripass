/**
 * DossierTimeline — Timeline audit verticale pour inspection dossier KYC
 * Source: veripass-gatekeeper prototype (src/components/shared/DossierTimeline.tsx)
 * Mapping vers BICEC VeriPass — pour EvidenceViewerPage (Jean)
 */
import { ActionType, type AuditEntry } from '@/types';
import { cn } from '@/lib/utils';
import {
  Check, X, MessageSquare, UserCheck, FileEdit,
  ShieldCheck, ArrowUp, GitMerge, Cpu, Fingerprint,
} from 'lucide-react';

const actionIconMap: Record<string, typeof Check> = {
  [ActionType.APPROVE]: Check,
  [ActionType.REJECT]: X,
  [ActionType.REQUEST_INFO]: MessageSquare,
  [ActionType.ASSIGN]: UserCheck,
  [ActionType.FIELD_EDIT]: FileEdit,
  [ActionType.OCR_CORRECT]: FileEdit,
  [ActionType.AML_CLEAR]: ShieldCheck,
  [ActionType.AML_CONFIRM]: ShieldCheck,
  [ActionType.AML_ESCALATE]: ArrowUp,
  [ActionType.MERGE_IDENTITY]: GitMerge,
  [ActionType.STATUS_CHANGE]: Cpu,
  [ActionType.SYSTEM_AUTO]: Cpu,
  [ActionType.BIOMETRIC_CHECK]: Fingerprint,
};

const actionColorMap: Record<string, string> = {
  [ActionType.APPROVE]: 'bg-green-100 text-green-700',
  [ActionType.REJECT]: 'bg-red-100 text-red-700',
  [ActionType.REQUEST_INFO]: 'bg-yellow-100 text-yellow-700',
  [ActionType.ASSIGN]: 'bg-primary/10 text-primary',
  [ActionType.AML_CLEAR]: 'bg-green-100 text-green-700',
  [ActionType.AML_ESCALATE]: 'bg-orange-100 text-orange-700',
  [ActionType.SYSTEM_AUTO]: 'bg-muted text-muted-foreground',
};

interface DossierTimelineProps {
  entries: AuditEntry[];
  className?: string;
}

export function DossierTimeline({ entries, className }: DossierTimelineProps) {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className={cn('space-y-0', className)}>
      {sorted.map((entry, i) => {
        const Icon = actionIconMap[entry.actionType] || Cpu;
        const color = actionColorMap[entry.actionType] || 'bg-muted text-muted-foreground';
        const time = new Date(entry.timestamp);

        return (
          <div key={entry.id} className="flex gap-2 pb-3 relative">
            {i < sorted.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
            )}
            <div className={cn('flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center', color)}>
              <Icon className="h-3 w-3" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-medium text-foreground">{entry.agentName}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {time.toLocaleDateString('fr-FR')}{' '}
                  {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                {entry.rationale}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 text-[9px]">
                <span className="bg-muted px-1.5 py-0.5 rounded font-mono">{entry.previousState}</span>
                <span className="text-muted-foreground">→</span>
                <span className="bg-muted px-1.5 py-0.5 rounded font-mono">{entry.newState}</span>
              </div>
            </div>
          </div>
        );
      })}
      {sorted.length === 0 && (
        <p className="text-[11px] text-muted-foreground py-2 text-center">Aucun événement</p>
      )}
    </div>
  );
}
