import { formatWeekRange } from '../shared/dates.js';
import type { IsoDate } from '../shared/types.js';
import { weekWindow } from '../shared/window.js';
import type { Repository } from './repository.js';
import type { SlackPoster } from './slack.js';

export function buildReminderText(weekStart: IsoDate, appUrl: string): string {
  return `<!here> Hora de preencher a escala de home office da semana de ${formatWeekRange(weekStart)} 👉 <${appUrl}/?week=${weekStart}|abrir escala>`;
}

export async function sendWeeklyReminder(deps: {
  repo: Repository;
  slack: SlackPoster;
  today: IsoDate;
  appUrl: string;
}): Promise<'sent' | 'already-sent'> {
  const nextWeekStart = weekWindow(deps.today).maxWeekStart;
  return deps.repo.withLock(async (tx) => {
    if (await tx.isReminderSent(nextWeekStart)) return 'already-sent';
    await deps.slack.post(buildReminderText(nextWeekStart, deps.appUrl));
    await tx.markReminderSent(nextWeekStart);
    return 'sent';
  });
}
