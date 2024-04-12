import { NostrEvent } from '@nostr-dev-kit/ndk';
import { Debugger } from 'debug';
import { logger } from '@lawallet/module';
import { GameContext } from '@src/index';
import {
  GAME_STATE_SELECT,
  GameStateData,
  gameStateEvent,
  powerReceiptEvent,
} from '@src/utils';
import { UnsignedEvent, getEventHash } from 'nostr-tools';
import { republishEvents } from '@nostr/zapReceipt';
import { Prisma, PrismaClient, RoundPlayer } from '@prisma/client';

const log: Debugger = logger.extend('services:power');
const warn: Debugger = log.extend('warn');
const error: Debugger = log.extend('error');

export enum PowerType {
  LIGHTNING = 'LIGHTNING',
  ONCHAIN = 'ONCHAIN',
  MASSACRE = 'MASSACRE',
}

export type PowerData = {
  type: PowerType;
  walias: string;
  amount: number;
  gameId: string;
  message: string;
};

export type LightningPower = {
  zapReceipt: NostrEvent;
} & PowerData;

export type OnchainPower = {
  txId: string;
  playerId: string;
} & PowerData;

/**
 * Updates a game based on power added
 *
 * @param powerData of added power
 * @param roundPlayer that will receive this power
 * @param prisma client instance
 * @param zapReceipt associated with this power, only needed when
 *   adding lightning power
 *
 */
async function updateGame(
  powerData: LightningPower | OnchainPower,
  roundPlayer: RoundPlayer,
  prisma: PrismaClient,
): Promise<GameStateData> {
  const { amount, gameId } = powerData;
  const maxZap = amount < roundPlayer.maxZap ? roundPlayer.maxZap : amount;
  const roundPlayerData: Prisma.RoundPlayerUpdateWithoutRoundInput = {
    maxZap,
    zapped: { increment: amount },
    zapCount: { increment: 1 },
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
  };
  switch (powerData.type) {
    case PowerType.LIGHTNING:
      powerData = powerData as LightningPower;
      roundPlayerData.zapReceipts = {
        create: {
          id: powerData.zapReceipt.id!,
          event: JSON.stringify(powerData.zapReceipt),
        },
      };
      break;
    case PowerType.ONCHAIN:
      powerData = powerData as OnchainPower;
      roundPlayerData.txOutputs = {
        connect: {
          txId_playerId: {
            txId: powerData.txId,
            playerId: powerData.playerId,
          },
        },
      };
      break;
    case PowerType.MASSACRE:
    default:
      throw new Error(`Unexpected power type: ${powerData.type}`);
  }
  return await prisma.game.update({
    data: {
      currentPool: { increment: amount },
      currentRound: {
        update: {
          roundPlayers: {
            update: {
              data: roundPlayerData,
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
}

/**
 * Adds power to a player and publishes the required events
 *
 * @param powerData to use when adding power
 * @param zapReceipt that added this power
 * @param ctx of the application
 */
export async function addLightningPower(
  powerData: LightningPower,
  ctx: GameContext,
): Promise<void> {
  const { gameId, walias, amount, zapReceipt } = powerData;
  const roundPlayer = await ctx.prisma.roundPlayer.findFirst({
    where: {
      player: { walias },
      round: { gameId },
    },
    orderBy: { round: { number: 'desc' } },
  });
  if (!roundPlayer) {
    error('%s is not a player alive on %$s', walias, gameId);
    return;
  }
  const game = await updateGame(powerData, roundPlayer, ctx.prisma);
  const powerReceipt = powerReceiptEvent(
    game,
    amount,
    powerData,
    zapReceipt.id!,
  );
  await Promise.allSettled([
    ctx.outbox.publish(powerReceipt),
    ctx.outbox.publish(
      gameStateEvent(game, getEventHash(powerReceipt as UnsignedEvent)),
    ),
  ]).then(async (results) => {
    log('Publish results: %O', results);
    if ('rejected' === results[0].status) {
      await republishEvents(zapReceipt, ctx);
    } else {
      await ctx.prisma.zapReceipt.update({
        data: { isAnswered: true },
        where: { id: zapReceipt.id! },
      });
    }
  });
}

/**
 * Adds power to a player and publishes the required events
 *
 * @param powerData to use when adding power
 * @param txId that added this power
 * @param ctx of the application
 */
export async function addOnchainPower(
  powerData: OnchainPower,
  ctx: GameContext,
): Promise<void> {
  const { gameId, walias, amount } = powerData;
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
  const game = await updateGame(powerData, roundPlayer, ctx.prisma);
  const powerReceipt = powerReceiptEvent(
    game,
    amount,
    powerData,
    powerData.txId,
  );
  await Promise.allSettled([
    ctx.outbox.publish(powerReceipt),
    ctx.outbox.publish(
      gameStateEvent(game, getEventHash(powerReceipt as UnsignedEvent)),
    ),
  ]).then(async (results) => {
    log('Publish results: %O', results);
    if ('rejected' === results[0].status) {
      //TODO what to do?
    } else {
      await ctx.prisma.transactionOutput.update({
        data: { isAnswered: true },
        where: {
          txId_playerId: {
            txId: powerData.txId,
            playerId: powerData.playerId,
          },
        },
      });
    }
  });
}

export async function addMassacrePower(
  _powerData: PowerData,
  _ctx: GameContext,
): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}
