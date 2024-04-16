import { Kind, logger, nowInSeconds, requiredEnvVar } from '@lawallet/module';
import { NostrEvent } from '@nostr-dev-kit/ndk';
import {
  GAME_STATE_SELECT,
  GameStateData,
  powerByPlayer,
  powerReceiptEvent,
} from '@src/utils';
import { GameContext } from '@src/index';
import { Prisma, Status } from '@prisma/client';
import { UnsignedEvent, getEventHash } from 'nostr-tools';
import { MsBlock } from '@src/mempoolspace';
import { halve } from '@lib/lottery';
import { Debugger } from 'debug';

const log: Debugger = logger.extend('lib:massacre');
const debug: Debugger = log.extend('debug');

export function massacreEvent(
  game: Pick<GameStateData, 'id' | 'currentRound'>,
  block: MsBlock,
  deadPlayers: string[],
): NostrEvent {
  const content = JSON.stringify({
    block: {
      id: block.id,
      height: block.height,
      header: block.extras['header'],
    },
    players: powerByPlayer(
      game.currentRound.roundPlayers.map((rp) => rp.player),
    ),
    deadPlayers,
  });
  return {
    content,
    pubkey: requiredEnvVar('NOSTR_PUBLIC_KEY'),
    kind: Kind.REGULAR,
    tags: [
      ['e', game.id, '', 'setup'],
      ['L', 'halving-massacre'],
      ['l', 'massacre', 'halving-massacre'],
      ['block', block.height.toString()],
      ['hash', block.id],
    ],
    created_at: nowInSeconds(),
  };
}

/**
 * Run all the logic associated with a massacre (not the final one)
 *
 * Important, we assume that the massacre to be applied is not the
 * final one, the caller is responsible to determine this
 *
 * @param game state with information about current and next round
 * @param block to use as the base for the massacre
 * @param ctx of the game
 */
export async function applyMassacre(
  game: Pick<GameStateData, 'id' | 'currentRound'>,
  block: MsBlock,
  ctx: GameContext,
): Promise<void> {
  log('Massacre begin! for game %s and block %s', game.id, block.height);
  debug('For game %s received block %O', game.id, block);
  const players = powerByPlayer(
    game.currentRound.roundPlayers.map((rp) => rp.player),
  );
  const lotteryRes = halve(block.id, players);
  log('Ran lottery');
  debug('Lottery result: %O', lotteryRes);
  const winnerWaliases = Object.keys(lotteryRes.winners);
  const roundPlayers: Prisma.RoundPlayerUpdateManyWithoutRoundNestedInput = {
    create: winnerWaliases.map((walias) => ({
      player: { connect: { gameId_walias: { gameId: game.id, walias } } },
    })),
  };
  log('Killing losers and initiatig next round...');
  const [_batchWinners, _round, _batchLosers, updatedGame] =
    await ctx.prisma.$transaction([
      ctx.prisma.player.updateMany({
        data: { power: { increment: lotteryRes.delta } },
        where: { gameId: game.id, walias: { in: winnerWaliases } },
      }),
      ctx.prisma.round.update({
        data: { roundPlayers },
        where: { id: game.currentRound.nextRound!.id },
      }),
      ctx.prisma.player.updateMany({
        data: { deathRoundId: game.currentRound.id },
        where: { gameId: game.id, walias: { in: lotteryRes.losers } },
      }),
      ctx.prisma.game.update({
        select: GAME_STATE_SELECT,
        data: {
          currentRound: { connect: { id: game.currentRound.nextRound!.id } },
          status: Status.NORMAL,
        },
        where: { id: game.id },
      }),
    ]);
  log('Generating and publishing massacre events...');
  const massacreE = massacreEvent(updatedGame, block, lotteryRes.losers);
  const eventHash = getEventHash(massacreE as UnsignedEvent);
  ctx.statePublisher.queue(game.id, eventHash);
  const publishPromises = [ctx.outbox.publish(massacreE)];
  for (const roundPlayer of updatedGame.currentRound.roundPlayers) {
    ctx.statePublisher.queueProfile(
      game.id,
      roundPlayer.player.walias,
      eventHash,
    );
    const powerEvent = powerReceiptEvent(
      updatedGame,
      lotteryRes.delta,
      {
        message: 'You survived! For now...',
        walias: roundPlayer.player.walias,
      },
      eventHash,
    );
    publishPromises.push(ctx.outbox.publish(powerEvent));
  }
  const publishResults = await Promise.allSettled(publishPromises);
  debug('Publication results: %O', publishResults);
  log('Finished the massacre!');
}
