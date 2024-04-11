import {
  EventHandler,
  getTagValue,
  logger,
  requiredEnvVar,
} from '@lawallet/module';
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
import { NDKEvent, NDKFilter, NostrEvent } from '@nostr-dev-kit/ndk';
import { PowerType, addLightningPower } from '@services/power';

const log: Debugger = logger.extend('nostr:zapReceipt');
const warn: Debugger = log.extend('warn');
const error: Debugger = log.extend('error');
const debug: Debugger = log.extend('debug');

const filter: NDKFilter = {
  kinds: [9735],
  authors: [requiredEnvVar('BTC_GATEWAY_PUBLIC_KEY')],
  '#p': requiredEnvVar('POOLS_PUBLIC_KEYS').split(','),
  since: Math.floor(Date.now() / 1000) - 86000,
  until: Math.floor(Date.now() / 1000) + 86000,
};

const POWER_GIFT = 21000;

async function consumeTicket(
  content: ZapTicketContent,
  amount: number,
  zapReceiptEvent: NostrEvent,
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
  const zapReceiptId = zapReceiptEvent.id!;
  const game = await ctx.prisma.game.update({
    data: {
      currentPool: { increment: ticket.game.ticketPrice },
      currentRound: {
        update: {
          roundPlayers: {
            create: {
              zapReceipts: {
                create: {
                  id: zapReceiptEvent.id!,
                  event: JSON.stringify(zapReceiptEvent),
                  ticket: { connect: { id: ticketId } },
                },
              },
              player: {
                create: {
                  gameId,
                  walias: ticket.walias,
                  ticketId,
                  power: POWER_GIFT,
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
  const powerReceipt = powerReceiptEvent(
    game,
    POWER_GIFT,
    { message: 'Your first power!', walias: ticket.walias },
    zapReceiptId,
  );
  await Promise.allSettled([
    ctx.outbox.publish(ticketE),
    ctx.outbox.publish(powerReceipt),
    ctx.outbox.publish(
      gameStateEvent(game, getEventHash(ticketE as UnsignedEvent)),
    ),
  ]).then(async (results) => {
    log('Publish results: %O', results);
    if ('rejected' === results[0].status) {
      await republishEvents(zapReceiptEvent, ctx);
    } else {
      await ctx.prisma.zapReceipt.update({
        data: { isAnswered: true },
        where: { id: zapReceiptEvent.id! },
      });
    }
  });
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

export async function republishEvents(
  zapReceiptEvent: NostrEvent,
  ctx: GameContext,
): Promise<void> {
  log('Did not publish event, publishing...');
  const zapRequest = JSON.parse(
    getTagValue(zapReceiptEvent, 'description')!,
  ) as NostrEvent;
  let content = validateContent(zapRequest.content)!;
  const game = await ctx.prisma.game.findUnique({
    select: GAME_STATE_SELECT,
    where: { id: content.gameId },
  });
  const amount = Number(getTagValue(zapRequest, 'amount'));
  switch (content.type.toUpperCase()) {
    case ZapType.TICKET.valueOf(): {
      content = content as ZapTicketContent;
      const ticket = await ctx.prisma.ticket.findUnique({
        select: { walias: true },
        where: { id: content.ticketId },
      });
      const ticketE = ticketEvent(game!, ticket!.walias, zapReceiptEvent.id!);
      await ctx.outbox.publish(ticketE).then(async () => {
        debug('Published ticket event correctly');
        await ctx.prisma.zapReceipt.update({
          data: { isAnswered: true },
          where: { id: zapReceiptEvent.id! },
        });
      });
      break;
    }
    case ZapType.POWER.valueOf(): {
      content = content as ZapPowerContent;
      const powerReceipt = powerReceiptEvent(
        game!,
        amount,
        content,
        zapReceiptEvent.id!,
      );
      await ctx.outbox.publish(powerReceipt).then(async () => {
        debug('Published power event correctly');
        await ctx.prisma.zapReceipt.update({
          data: { isAnswered: true },
          where: { id: zapReceiptEvent.id! },
        });
      });
      break;
    }
    default:
      error('Invalid type: %s', content.type.toUpperCase());
      break;
  }
  return;
}

function getHandler<Context extends GameContext>(ctx: Context): EventHandler {
  return async (ndkEvent: NostrEvent): Promise<void> => {
    const event = await (ndkEvent as NDKEvent).toNostrEvent();
    const existing = await ctx.prisma.zapReceipt.findUnique({
      where: { id: event.id! },
    });
    if (existing) {
      if (existing.isAnswered) {
        log('Already handled event: %s', existing.id);
      } else {
        warn(
          `Already handled zap receipt ${event.id} but answer was not published, publishing...`,
        );
        await republishEvents(event, ctx);
      }
      return;
    }
    debug('Received event %s', event.id);
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
    const poolPubKey = getTagValue(event, 'p') ?? '';
    const gameExists = await ctx.prisma.game.findUnique({
      where: { id: content.gameId, poolPubKey },
    });
    if (!gameExists) {
      warn(
        'No game with id %s for poolPubKey: %s ',
        content.gameId,
        poolPubKey,
      );
      return;
    }
    const amount = Number(getTagValue(zapRequest, 'amount'));
    switch (content.type.toUpperCase()) {
      case ZapType.TICKET.valueOf():
        debug('Consuming ticket: %O', content);
        await consumeTicket(content as ZapTicketContent, amount, event, ctx);
        debug('Published ticket events correctly');
        break;
      case ZapType.POWER.valueOf():
        debug('Adding power: %O', content);
        await addLightningPower(
          {
            ...(content as ZapPowerContent),
            type: PowerType.LIGHTNING,
            amount,
            zapReceipt: event,
          },
          ctx,
        );
        debug('Published power events correctly');
        break;
      case ZapType.ONCHAIN_ADDRESS.valueOf():
          debug('Generating onchain address: %O', content);
          // TODO: Validate that the player has not an address already
  
          // const index = 0; // This index should autoincrease on each new address created
          // const zpub = requiredEnvVar('ONCHAIN_ZPUB_KEY');
  
          // const BIP84 = require('bip84')
          // const account = new BIP84.fromZPub(zpub);
  
          // // Path : m/84'/1'/0'/0/1
          // const address = account.getAddress(index);
  
          // Update the prisma player profile with the new address
  
          // Publish updated profile event
        break;
      default:
        error('Invalid type: %s', content.type.toUpperCase());
        break;
    }
  };
}

export { filter, getHandler };
