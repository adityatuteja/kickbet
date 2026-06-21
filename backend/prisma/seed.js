import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash('admin123', 10);
  const userPass  = await bcrypt.hash('pass123',  10);

  const admin = await prisma.user.upsert({
    where:  { username: 'admin' },
    update: { isRootAdmin: true },
    create: { username:'admin', alias:'PitchAdmin', email:'admin@kickbet.com', password:adminPass, isAdmin:true, isRootAdmin:true, balance:0 }
  });

  const alice = await prisma.user.upsert({
    where:  { username: 'alice' },
    update: {},
    create: { username:'alice', alias:'GhostStriker', email:'alice@example.com', password:userPass, balance:10000, girlsEduTotal:90 }
  });

  const bob = await prisma.user.upsert({
    where:  { username: 'bob' },
    update: {},
    create: { username:'bob', alias:'NightOwl99', email:'bob@example.com', password:userPass, balance:5000, girlsEduTotal:45 }
  });

  // Pool commitments
  for (const [u, committed, confirmed] of [[alice, 15000, 10000],[bob, 10000, 5000]]) {
    const existing = await prisma.poolCommitment.findUnique({ where:{ userId: u.id } });
    if (!existing) {
      const c = await prisma.poolCommitment.create({
        data: { userId: u.id, totalCommitted: committed, totalConfirmed: confirmed }
      });
      await prisma.poolTransaction.createMany({ data: [
        { commitmentId: c.id, type:'USER_PLEDGE',     amount: committed, receiptStatus: confirmed === committed ? 'RECEIVED' : 'PARTIAL', amountReceived: confirmed, note:'Initial commitment' },
      ]});
    }
  }

  // Sample payment methods (admin's accounts)
  const existingMethods = await prisma.paymentMethod.count();
  if (existingMethods === 0) {
    await prisma.paymentMethod.createMany({
      data: [
        { type:'CASH', label:'Love Bites — weekend meetup', cashAddress:'12 MG Road, Bangalore 560001', cashContact:'+91 98765 43210', notes:'Available weekends, please call first' },
      ]
    });
  }

  // Sample match
  const now     = new Date();
  const opensAt = new Date(now.getTime() + 2*60*60*1000);
  const closeAt = new Date(now.getTime() + 10*60*60*1000);
  const kickoff = new Date(now.getTime() + 10.5*60*60*1000);

  const existing = await prisma.match.findFirst({ where:{ homeTeam:'Brazil' } });
  if (!existing) {
    const m = await prisma.match.create({
      data: {
        homeTeam:'Brazil', awayTeam:'Germany', homeFlag:'🇧🇷', awayFlag:'🇩🇪',
        kickoffAt: kickoff, bettingOpensAt: opensAt, bettingClosesAt: closeAt,
        status:'BETTING_OPEN', stage:'Group Stage',
        questions: { create: [
          { text:'Who wins the match?', order:1, minStake:50, options:{ create:[
            {label:'Brazil'}, {label:'Draw'}, {label:'Germany'},
          ]}},
          { text:'Total goals in the match?', order:2, minStake:30, options:{ create:[
            {label:'Under 2.5'}, {label:'2–4 goals'}, {label:'Over 4'},
          ]}},
          { text:'First goal before 30 min?', order:3, minStake:20, options:{ create:[
            {label:'Yes'}, {label:'No'},
          ]}},
        ]}
      },
      include: { questions: { include: { options: true } } }
    });

    // Seed a couple of demo bets so the live odds board isn't empty
    const q1 = m.questions[0];
    const brazil = q1.options.find(o => o.label === 'Brazil');
    const germany = q1.options.find(o => o.label === 'Germany');
    if (brazil && germany) {
      const aliceBet = await prisma.bet.create({
        data: { userId: alice.id, matchId: m.id, totalStake: 200, girlsEduPct: 10, status: 'PENDING' }
      });
      await prisma.betPick.create({
        data: { betId: aliceBet.id, questionId: q1.id, optionId: brazil.id, stake: 200, potentialWin: 0 }
      });
      await prisma.user.update({ where:{ id: alice.id }, data:{ committed:{ increment: 200 } } });

      const bobBet = await prisma.bet.create({
        data: { userId: bob.id, matchId: m.id, totalStake: 100, girlsEduPct: 5, status: 'PENDING' }
      });
      await prisma.betPick.create({
        data: { betId: bobBet.id, questionId: q1.id, optionId: germany.id, stake: 100, potentialWin: 0 }
      });
      await prisma.user.update({ where:{ id: bob.id }, data:{ committed:{ increment: 100 } } });
    }
  }

  // Sample tournament-wide questions
  const existingTourn = await prisma.question.findFirst({ where: { scope: 'TOURNAMENT' } });
  if (!existingTourn) {
    await prisma.question.create({
      data: {
        scope:'TOURNAMENT', text:'🏆 Who will win the tournament?', order:1, minStake:100,
        options:{ create:[{label:'Brazil'},{label:'Germany'},{label:'Argentina'},{label:'France'},{label:'Spain'}] }
      }
    });
    await prisma.question.create({
      data: {
        scope:'TOURNAMENT', text:'⚽ Golden Boot — who scores the most goals?', order:2, minStake:100,
        options:{ create:[{label:'Mbappé'},{label:'Vinícius Jr'},{label:'Kane'},{label:'Messi'},{label:'Other'}] }
      }
    });
  }

  console.log('Seeded successfully');
}

main().catch(console.error).finally(() => prisma.$disconnect());
