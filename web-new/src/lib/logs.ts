export const LOG_IDS = ['atomhack', 'healthcheck', 'tools', 'update', 'lighttpd'] as const;

export type LogId = (typeof LOG_IDS)[number];

export function isLogId(v: string): v is LogId {
  return (LOG_IDS as readonly string[]).includes(v);
}
