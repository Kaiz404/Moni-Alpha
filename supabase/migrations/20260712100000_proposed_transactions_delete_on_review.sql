-- Proposals are soft-deleted on approve/decline; only unreviewed rows remain.
-- Clean up legacy approved/rejected rows that were kept with a status update.

UPDATE public.proposed_transactions
SET deleted = true, updated_at = now()
WHERE status IN ('approved', 'rejected') AND deleted = false;
