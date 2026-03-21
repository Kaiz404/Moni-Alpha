import type { CreateProposedTransaction } from '@repo/types';

export type WalletRecord = { id: string; name?: string | null };

export type TraceEvent = {
  stage: 'orchestrator' | 'classifier' | 'extractor' | 'wallet-resolver' | 'creator';
  event: string;
  details?: Record<string, unknown>;
};

export type TraceLogger = (event: TraceEvent) => void;

export type OrchestrationOptions = {
  trace?: TraceLogger;
  adapters?: {
    getWallets?: () => Promise<WalletRecord[]>;
    createProposedTransaction?: (tx: CreateProposedTransaction) => Promise<unknown>;
  };
};

export type OrchestrationResult = {
  created: boolean;
  skipped: boolean;
  reason: string;
  proposalId?: string;
};
