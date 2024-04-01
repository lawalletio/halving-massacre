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
    const isAddPower = LUD16_RE.test(zapRequest.content);
    if (isAddPower) {
      const amount = Number(getTagValue(zapRequest, 'amount'));
      const lud16 = zapRequest.content;
      const roundPlayer = await ctx.prisma.roundPlayer.findFirst({
        where: {
          player: { lud16 },
          round: {
            gameId,
          },
        },
        orderBy: {
          round: {
            number: 'desc',
          },
        },
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
                    zapRequests: { push: event.id! },
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
        event.id!,
      );
      await Promise.all([
        ctx.outbox.publish(powerReceipt),
        ctx.outbox.publish(
          gameStateEvent(game, getEventHash(powerReceipt as UnsignedEvent)),
        ),
      ]);
      return;
    } /*isBuyTicket*/ else {
      //TODO
    }
  };
}

export { filter, getHandler };
