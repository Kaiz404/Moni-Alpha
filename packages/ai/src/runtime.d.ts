/**
 * The web-standard globals this package calls, which React Native, browsers and Node all provide.
 * The shared tsconfig has no DOM library, so these few are declared here and nothing else slips in.
 * No source file references this file, so each app type-checks the package against its own globals.
 */

interface AbortSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

declare class AbortController {
  readonly signal: AbortSignal;
  abort(): void;
}

declare function setTimeout(handler: () => void, ms: number): unknown;
declare function clearTimeout(id: unknown): void;

declare function fetch(
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
