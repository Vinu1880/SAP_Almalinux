// lib/pathSecurity.ts - Path traversal protection
import path from 'path';
import { logSecurityEvent } from './securityLogger';

export function safePath(baseDir: string, fileName: string): string | null {
  if (
    fileName.includes('..') ||
    fileName.includes('\0') ||
    path.isAbsolute(fileName)
  ) {
    logSecurityEvent({
      type: 'PATH_TRAVERSAL_ATTEMPT',
      details: `fileName=${fileName}`,
    });
    return null;
  }

  const resolvedPath = path.resolve(baseDir, fileName);
  const resolvedBase = path.resolve(baseDir);

  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    logSecurityEvent({
      type: 'PATH_TRAVERSAL_ATTEMPT',
      details: `fileName=${fileName} resolved=${resolvedPath}`,
    });
    return null;
  }

  return resolvedPath;
}
