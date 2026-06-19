// lib/cron.js
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendMatchNotification } from './mailer.js';

const prisma = new PrismaClient();

export function startCronJobs() {
  // Every minute: open/close betting windows automatically
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    // Open betting for matches whose window has started
    await prisma.match.updateMany({
      where: { status: 'UPCOMING', bettingOpensAt: { lte: now } },
      data: { status: 'BETTING_OPEN' }
    });

    // Close betting 30 min before kickoff
    const closed = await prisma.match.findMany({
      where: { status: 'BETTING_OPEN', bettingClosesAt: { lte: now } }
    });
    for (const m of closed) {
      await prisma.match.update({ where: { id: m.id }, data: { status: 'BETTING_CLOSED' } });
    }

    // Mark as LIVE at kickoff
    await prisma.match.updateMany({
      where: { status: 'BETTING_CLOSED', kickoffAt: { lte: now } },
      data: { status: 'LIVE' }
    });
  });

  // Every hour: send email notifications for matches opening in ~12h
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    const in12h = new Date(now.getTime() + 12*60*60*1000);
    const in12h5 = new Date(now.getTime() + 12*60*60*1000 + 5*60*1000);

    const upcoming = await prisma.match.findMany({
      where: { status: 'UPCOMING', bettingOpensAt: { gte: in12h, lte: in12h5 } }
    });
    if (!upcoming.length) return;

    const users = await prisma.user.findMany({ select: { email:true, alias:true } });
    for (const match of upcoming) {
      for (const user of users) {
        await sendMatchNotification(user.email, user.alias, match).catch(console.error);
      }
    }
  });

  console.log('Cron jobs started');
}
