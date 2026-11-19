-- A capture has two answers, Approve or Not mine. Captures saved for later go back to Review.
-- snoozed_until stays: an installed older app still sends it, and an unknown column fails that
-- row's sync.
UPDATE public.proposed_transactions
  SET status = 'pending', snoozed_until = NULL
  WHERE status = 'later';

-- An older app that still offers Later keeps syncing: its Later lands as pending, before the check.
CREATE OR REPLACE FUNCTION public.proposed_transactions_later_to_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'later' THEN
    NEW.status := 'pending';
    NEW.snoozed_until := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER proposed_transactions_later_to_pending
  BEFORE INSERT OR UPDATE ON public.proposed_transactions
  FOR EACH ROW EXECUTE FUNCTION public.proposed_transactions_later_to_pending();

ALTER TABLE public.proposed_transactions DROP CONSTRAINT proposed_transactions_status_check;
ALTER TABLE public.proposed_transactions ADD CONSTRAINT proposed_transactions_status_check
  CHECK (status IN ('pending', 'rejected', 'approved'));
