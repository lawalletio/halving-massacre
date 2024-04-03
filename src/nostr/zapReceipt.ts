import {
  EventHandler,
  getTagValue,
  logger,
  requiredEnvVar,
} from '@lawallet/module';
import { NDKFilter, NostrEvent } from 'node_modules/@nostr-dev-kit/ndk/dist';
import { GameContext } from '../index';
import {
  GAME_STATE_SELECT,
  LUD16_RE,
  gameStateEvent,
  powerReceiptEvent,
  ticketEvent,
} from '../utils';
import {
  type Event,
  validateEvent,
  verifySignature,
  getEventHash,
  UnsignedEvent,
} from 'nostr-tools';
import { Debugger } from 'debug';

const log: Debugger = logger.extend('nostr:zapReceipt');
const warn: Debugger = log.extend('warn');

const filter: NDKFilter = {
  kinds: [9735],
  authors: [requiredEnvVar('BTC_GATEWAY_PUBLIC_KEY')],
  '#p': [requiredEnvVar('NOSTR_PUBLIC_KEY')],
  since: Math.floor(Date.now() / 1000) - 86000,
  until: Math.floor(Date.now() / 1000) + 86000,
};

async function addPower(
  zapRequest: NostrEvent,
  gameId: string,
  zapReceiptId: string,
  ctx: GameContext,
): Promise<void> {
  const amount = Number(getTagValue(zapRequest, 'amount'));
  const lud16 = zapRequest.content;
  const roundPlayer = await ctx.prisma.roundPlayer.findFirst({
    where: {
      player: { lud16 },
      round: { gameId },
    },
    orderBy: { round: { number: 'desc' } },
  });
  if (!roundPlayer) {
    warn('%s is not a player alive on $s', lud16, gameId);
    return;
  }
  const maxZap = amount < roundPlayer.maxZap ? roundPlayer.maxZap : amount;
  const game = await ctx.prisma.game.update({
    data: {
      currentPool: { increment: amount },
      currentRound: {
        update: {
          roundPlayers: {
            update: {
              data: {
                maxZap,
                zapped: { increment: amount },
                zapCount: { increment: 1 },
                zapReceipts: { push: zapReceiptId },
                player: {
                  update: {
                    data: {
                      maxZap,
                      zapped: { increment: amount },
                      power: { increment: amount },
                      zapCount: { increment: 1 },
                    },
                  },
                },
              },
              where: {
                playerId_roundId: {
                  playerId: roundPlayer.playerId,
                  roundId: roundPlayer.roundId,
                },
              },
            },
          },
        },
      },
    },
    select: GAME_STATE_SELECT,
    where: { id: gameId },
  });
  const powerReceipt = powerReceiptEvent(
    game,
    amount.toString(),
    lud16,
    zapReceiptId,
  );
  await Promise.all([
    ctx.outbox.publish(powerReceipt),
    ctx.outbox.publish(
      gameStateEvent(game, getEventHash(powerReceipt as UnsignedEvent)),
    ),
  ]);
}

async function consumeTicket(
  zapRequest: NostrEvent,
  gameId: string,
  zapReceiptId: string,
  ctx: GameContext,
): Promise<void> {
  const amount = Number(getTagValue(zapRequest, 'amount'));
  const ticketId = zapRequest.content;
  const ticket = await ctx.prisma.ticket.findUnique({
    select: {
      id: true,
      lud16: true,
      game: { select: { ticketPrice: true } },
    },
    where: { id: ticketId, player: { is: null } },
  });
  if (!ticket) {
    warn('Available ticket not found: %s', ticketId);
    return;
  }
  if (ticket.game.ticketPrice < BigInt(amount)) {
    warn(
      'Zapped too little for ticket %s, received %d need %d',
      ticketId,
      ticket.game.ticketPrice,
      amount,
    );
    return;
  }
  const game = await ctx.prisma.game.update({
    data: {
      currentPool: { increment: ticket.game.ticketPrice },
      currentRound: {
        update: {
          roundPlayers: {
            create: {
              zapReceipts: [zapReceiptId],
              player: {
                create: {
                  gameId,
                  lud16: ticket.lud16,
                  ticketId,
                  power: 1,
                },
              },
            },
          },
        },
      },
    },
    select: GAME_STATE_SELECT,
    where: { id: gameId },
  });
  const ticketE = ticketEvent(game, ticket.lud16, zapReceiptId);
  await Promise.all([
    ctx.outbox.publish(ticketE),
    ctx.outbox.publish(
      gameStateEvent(game, getEventHash(ticketE as UnsignedEvent)),
    ),
  ]);
}

function getHandler<Context extends GameContext>(ctx: Context): EventHandler {
  return async (event: NostrEvent): Promise<void> => {
    const exists = await ctx.prisma.roundPlayer.findFirst({
      where: { zapReceipts: { has: event.id! } },
    });
    if (exists) {
      log(`Already handled zap receipt ${event.id}`);
      return;
    }
    const gameId = getTagValue(event, 'e');
    if (!gameId) {
      warn('INVALID ZAP RECEIPT, NEED e TAG FOR GAME ID %O', event.id);
      return;
    }
    const strZapRequest = getTagValue(event, 'description');
    if (!strZapRequest) {
      warn('INVALID ZAP RECEIPT, NEED DESCRIPTION %O', event.id);
      return;
    }
    const zapRequest = JSON.parse(strZapRequest) as NostrEvent;
    if (requiredEnvVar('NOSTR_PUBLIC_KEY') !== zapRequest.pubkey) {
      warn('We did not generated this zapRequest %s', event.id);
      return;
    }
    if (!validateEvent(zapRequest) || !verifySignature(zapRequest as Event)) {
      warn('INVALID ZAP REQUEST', zapRequest);
      return;
    }
    if (LUD16_RE.test(zapRequest.content)) {
      await addPower(zapRequest, gameId, event.id!, ctx);
      return;
    } else {
      await consumeTicket(zapRequest, gameId, event.id!, ctx);
      return;
    }
  };
}

export { filter, getHandler };
