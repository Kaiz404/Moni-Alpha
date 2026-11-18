import {
  deleteAccountResponseSchema,
  functionErrorSchema,
} from '@repo/types';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { z } from 'zod';

import { supabase } from '@/lib/supabase/client';

/** How a call to one of the account Edge Functions ended. `status` is the HTTP status of a refusal. */
export type FunctionResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'refused'; status: number; message: string }
  | { kind: 'unreachable' };

async function invoke<S extends z.ZodTypeAny>(
  name: string,
  body: object,
  schema: S,
): Promise<FunctionResult<z.infer<S>>> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const parsed = functionErrorSchema.safeParse(await response.json().catch(() => null));
    return {
      kind: 'refused',
      status: response.status,
      message: parsed.success ? parsed.data.error : error.message,
    };
  }
  if (error) return { kind: 'unreachable' };
  const parsed = schema.safeParse(data);
  return parsed.success
    ? { kind: 'ok', data: parsed.data }
    : { kind: 'refused', status: 200, message: 'Moni sent an answer this app does not understand' };
}

/** Deletes the signed-in user's account, receipts and every row on the server. Safe to retry. */
export function deleteAccount() {
  return invoke('delete-account', {}, deleteAccountResponseSchema);
}
