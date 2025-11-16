/**
 * Verbose Mode Utility
 *
 * Provides runtime access to verbose mode setting
 */

let verboseMode = false;

export function setVerboseMode(enabled: boolean): void {
  verboseMode = enabled;
}

export function isVerbose(): boolean {
  return verboseMode;
}

export function logVerbose(message: string, ...args: any[]): void {
  if (verboseMode) {
    console.log(message, ...args);
  }
}
