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
  ZapPowerContent,
  ZapTicketContent,
  ZapType,
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
const error: Debugger = log.extend('error');

const filter: NDKFilter = {
  kinds: [9735],
  authors: [requiredEnvVar('BTC_GATEWAY_PUBLIC_KEY')],
  '#p': [requiredEnvVar('NOSTR_PUBLIC_KEY')],
  since: Math.floor(Date.now() / 1000) - 86000,
  until: Math.floor(Date.now() / 1000) + 86000,
};

async function addPower(
  content: ZapPowerContent,
  amount: number,
  zapReceiptId: string,
  ctx: GameContext,
): Promise<void> {
  const { gameId, walias } = content;
  const roundPlayer = await ctx.prisma.roundPlayer.findFirst({
    where: {
      player: { walias },
      round: { gameId },
    },
    orderBy: { round: { number: 'desc' } },
  });
  if (!roundPlayer) {
    warn('%s is not a player alive on %$s', walias, gameId);
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
  const powerReceipt = powerReceiptEvent(game, amount, walias, zapReceiptId);
  await Promise.all([
    ctx.outbox.publish(powerReceipt),
    ctx.outbox.publish(
      gameStateEvent(game, getEventHash(powerReceipt as UnsignedEvent)),
    ),
  ]);
}

async function consumeTicket(
  content: ZapTicketContent,
  amount: number,
  zapReceiptId: string,
  ctx: GameContext,
): Promise<void> {
  const { gameId, ticketId } = content;
  const ticket = await ctx.prisma.ticket.findUnique({
    select: {
      id: true,
      walias: true,
      game: { select: { ticketPrice: true } },
    },
    where: { id: ticketId, player: { is: null } },
  });
  if (!ticket) {
    warn('Available ticket not found: %s', ticketId);
    return;
  }
  if (ticket.game.ticketPrice < amount) {
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
                  walias: ticket.walias,
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
  const ticketE = ticketEvent(game, ticket.walias, zapReceiptId);
  await Promise.all([
    ctx.outbox.publish(ticketE),
    ctx.outbox.publish(
      gameStateEvent(game, getEventHash(ticketE as UnsignedEvent)),
    ),
  ]);
}

function validateContent(
  content: string,
): ZapTicketContent | ZapPowerContent | null {
  let obj: object;
  try {
    obj = JSON.parse(content) as object;
  } catch (err: unknown) {
    warn('Error parsing zapRequest content: %O', err);
    return null;
  }
  if (
    !('type' in obj) ||
    !('gameId' in obj) ||
    'string' !== typeof obj.type ||
    'string' !== typeof obj.gameId
  ) {
    return null;
  }
  if (
    !('walias' in obj && 'string' === typeof obj.walias) &&
    !('ticketId' in obj && 'string' === typeof obj.ticketId)
  ) {
    return null;
  }
  return obj as ZapTicketContent | ZapPowerContent;
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
    const content = validateContent(zapRequest.content);
    if (!content) {
      warn('Invalid zap request content: %O', zapRequest.content);
      return;
    }
    const amount = Number(getTagValue(zapRequest, 'amount'));
    switch (content.type.toUpperCase()) {
      case ZapType.TICKET.valueOf():
        await consumeTicket(
          content as ZapTicketContent,
          amount,
          event.id!,
          ctx,
        );
        break;
      case ZapType.POWER.valueOf():
        await addPower(content as ZapPowerContent, amount, event.id!, ctx);
        break;
      default:
        error('Invalid type: %s', content.type.toUpperCase());
        break;
    }
  };
}

export { filter, getHandler };
