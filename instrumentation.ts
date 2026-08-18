// Next.js instrumentation hook (called once at server startup)
// Docs: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import so the module is not bundled for edge/other runtimes
    const { runStartupMigrations } = await import('./lib/dbMigrations');
    await runStartupMigrations();

    const { startBackupScheduler } = await import('./lib/backupScheduler');
    startBackupScheduler();
    // eslint-disable-next-line no-console
    console.log('[boot] Backup scheduler started');
  }
}
