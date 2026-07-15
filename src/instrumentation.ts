export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAgenda } = await import('./lib/agenda');
    await startAgenda();
  }
}
