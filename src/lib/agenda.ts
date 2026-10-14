import { Agenda } from 'agenda';
import { env } from './env';
import { getAllEnabledReportSettings } from './settings';
import { finishEmailAttempt, getReportAttemptSummary, startEmailAttempt } from './emailLog';
import { fetchDailyReportData, generateDailyReportPdf } from './reports/generateDailyReport';
import { sendDailyReportEmail } from './mail';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveTimezone } from './storeTime';

const JOB_NAME = 'send-daily-sales-report';
/** Failed sends are retried on later ticks, but only this many times per store per day. */
const MAX_DAILY_FAILURES = 3;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

let agenda: Agenda | null = null;

type AgendaGlobal = typeof globalThis & { _agenda?: Agenda; _agendaStarted?: Promise<void> };

function getAgendaInstance() {
  if (agenda) return agenda;

  if (env.NODE_ENV === "development") {
    const globalWithAgenda = global as AgendaGlobal;

    if (!globalWithAgenda._agenda) {
      globalWithAgenda._agenda = new Agenda({
        db: { address: env.MONGODB_URI, collection: 'agendaJobs' },
        processEvery: '1 minute'
      } as any);
    }
    agenda = globalWithAgenda._agenda;
  } else {
    agenda = new Agenda({
      db: { address: env.MONGODB_URI, collection: 'agendaJobs' },
      processEvery: '1 minute'
    } as any);
  }

  return agenda;
}

/** Sends today's report for one store if its scheduled time has passed and it hasn't gone out yet. */
async function processStore(store: Awaited<ReturnType<typeof getAllEnabledReportSettings>>[number], now: Date) {
  const reports = store.reports;
  if (!reports || !reports.enabled || !Array.isArray(reports.recipients) || !reports.recipients.length) return;

  const match = TIME_RE.exec(String(reports.time || ''));
  if (!match) {
    console.warn(`[Agenda] Skipping tenant ${store.tenant_id}: invalid report time "${reports.time}"`);
    return;
  }
  const timezone = resolveTimezone(reports.timezone);
  const targetMinutes = Number(match[1]) * 60 + Number(match[2]);
  const [currentHour, currentMin] = formatInTimeZone(now, timezone, 'HH:mm').split(':').map(Number);
  if (currentHour * 60 + currentMin < targetMinutes) return;

  const dateStr = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  const summary = await getReportAttemptSummary(store.tenant_id, 'DAILY_SALES', dateStr);
  if (summary.sent || summary.inFlight || summary.failures >= MAX_DAILY_FAILURES) return;

  const recipients = reports.recipients;
  console.log(`[Agenda] Sending daily report for tenant ${store.tenant_id}`);
  // Claimed before sending: if logging the result fails, the next tick still won't send a duplicate.
  const attemptId = await startEmailAttempt({ tenant_id: store.tenant_id, reportType: 'DAILY_SALES', date: dateStr, recipients });
  try {
    const data = await fetchDailyReportData(store.tenant_id, now, timezone);
    const pdfBuffer = await generateDailyReportPdf(data);
    await sendDailyReportEmail(recipients, pdfBuffer, data, timezone);
    await finishEmailAttempt(attemptId, 'SUCCESS');
  } catch (error: any) {
    console.error(`[Agenda] Failed to send report for tenant ${store.tenant_id}:`, error);
    await finishEmailAttempt(attemptId, 'FAILED', error?.message);
  }
}

export async function startAgenda() {
  // Instrumentation can run more than once per process (dev reloads): start, define and schedule only once.
  const g = global as AgendaGlobal;
  if (g._agendaStarted) return g._agendaStarted;

  g._agendaStarted = (async () => {
    const instance = getAgendaInstance();

    // concurrency 1 + agenda's job lock: one tick at a time across all app instances
    instance.define(JOB_NAME, { concurrency: 1, lockLifetime: 10 * 60 * 1000 }, async () => {
      const now = new Date();
      const settingsList = await getAllEnabledReportSettings();

      for (const store of settingsList) {
        // One store's bad settings or failure must not stop the others
        try {
          await processStore(store, now);
        } catch (error) {
          console.error(`[Agenda] Report check failed for tenant ${store.tenant_id}:`, error);
        }
      }
    });

    await instance.start();
    // every() upserts a single recurring job by name, so restarts and extra instances don't duplicate it
    await instance.every('* * * * *', JOB_NAME);
    console.log('[Agenda] Started successfully');
  })().catch((error) => {
    g._agendaStarted = undefined;
    throw error;
  });

  return g._agendaStarted;
}

export { agenda };
