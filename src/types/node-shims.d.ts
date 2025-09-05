// Node ESM/Browser test shims for vite/tsc
// Map "node:" specifiers to classic modules and declare __dirname for tests

declare module 'node:child_process' {
  // Minimal shim for tests; not full Node types
  export function spawnSync(...args: any[]): {
    pid?: number;
    stdout?: string | Buffer;
    stderr?: string | Buffer;
    status?: number | null;
    signal?: string | null;
  };
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}

// Some tests may reference __dirname under ts-node-like assumptions
declare const __dirname: string;
