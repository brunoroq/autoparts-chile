export type DiagnosticRow = Readonly<Record<string, string | number | boolean | null>>;
export function browserErrorCode(error: unknown): string;
export function socketErrorCode(error: unknown): string;
export class BrowserDiagnostics {
  constructor(options?: {measurementId?: string; now?: () => number; sink?: (row: DiagnosticRow) => void});
  phase: string;
  record(code: string, fields?: Record<string, unknown>): DiagnosticRow | null;
  snapshot(): {phase: string; firstFailure: DiagnosticRow | null; dropped: number; events: DiagnosticRow[]};
}
