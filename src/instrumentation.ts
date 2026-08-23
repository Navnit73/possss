export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL) {
    try {
      const { startAgenda } = await import('./lib/agenda');
      await startAgenda();
    } catch (error) {
      console.error('[Instrumentation] Error starting agenda:', error);
    }
  }
}

