export type LogFn = (message: string) => void;

export type DebugTestResult = {
  success: boolean;
  summary: string;
  details?: string;
};

export type DebugModule = {
  id: string;
  label: string;
  description: string;
  /** If true, the module has a toggle/stop action (e.g. heartbeat). */
  isToggle?: boolean;
  /** Return label for the stop action when isToggle is true. */
  stopLabel?: string;
  run: (log: LogFn) => Promise<DebugTestResult>;
  stop?: (log: LogFn) => Promise<void>;
  /** If true, this module is currently active (caller manages state). */
  isActive?: () => boolean;
};
