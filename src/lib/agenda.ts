import { Agenda } from 'agenda';
import { env } from './env';
import { getAllEnabledReportSettings } from './settings';
import { hasReportBeenSentToday, logEmailAttempt } from './emailLog';
import { fetchDailyReportData, generateDailyReportPdf } from './reports/generateDailyReport';
import { sendDailyReportEmail } from './mail';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

let agenda: Agenda | null = null;

function getAgendaInstance() {
  if (agenda) return agenda;

  if (env.NODE_ENV === "development") {
    const globalWithAgenda = global as typeof globalThis & {
      _agenda?: Agenda;
    };

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

export async function startAgenda() {
  const instance = getAgendaInstance();
  
  // Define Jobs
  instance.define('send-daily-sales-report', async (job: any) => {
    console.log('[Agenda] Running daily sales report check...');
    const now = new Date();
    
    // Fetch all tenants that have reports enabled
    const settingsList = await getAllEnabledReportSettings();
    
    for (const store of settingsList) {
      if (!store.reports || !store.reports.enabled || !store.reports.recipients.length) continue;

      const { time, timezone, recipients } = store.reports;
      
      const currentTimeInTZ = formatInTimeZone(now, timezone || 'UTC', 'HH:mm');
      
      const [targetHour, targetMin] = time.split(':').map(Number);
      const [currentHour, currentMin] = currentTimeInTZ.split(':').map(Number);
      
      const isTimePassed = (currentHour > targetHour) || (currentHour === targetHour && currentMin >= targetMin);
      
      if (isTimePassed) {
        const dateStr = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
        
        const alreadySent = await hasReportBeenSentToday(store.tenant_id, 'DAILY_SALES', dateStr);
        
        if (!alreadySent) {
          console.log(`[Agenda] Sending daily report for tenant ${store.tenant_id}`);
          try {
            const data = await fetchDailyReportData(store.tenant_id, now, timezone);
            const pdfBuffer = await generateDailyReportPdf(data);
            await sendDailyReportEmail(recipients, pdfBuffer, data, timezone);
            
            await logEmailAttempt({
              tenant_id: store.tenant_id,
              reportType: 'DAILY_SALES',
              date: dateStr,
              status: 'SUCCESS',
              sentAt: new Date(),
              recipients
            });
            
          } catch (error: any) {
            console.error(`[Agenda] Failed to send report for tenant ${store.tenant_id}:`, error);
            await logEmailAttempt({
              tenant_id: store.tenant_id,
              reportType: 'DAILY_SALES',
              date: dateStr,
              status: 'FAILED',
              sentAt: new Date(),
              recipients,
              error: error.message
            });
          }
        }
      }
    }
  });

  await instance.start();
  const jobs = await instance.jobs({ name: 'send-daily-sales-report' });
  if (jobs.length === 0) {
    await instance.every('* * * * *', 'send-daily-sales-report'); 
  }
  console.log('[Agenda] Started successfully');
}

export { agenda };


