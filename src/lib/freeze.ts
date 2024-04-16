import { Kind, nowInSeconds, requiredEnvVar } from '@lawallet/module';
import { NostrEvent } from '@nostr-dev-kit/ndk';
import { GAME_STATE_SELECT, GameStateData, powerByPlayer } from '@src/utils';
import { GameContext } from '@src/index';
import { Status } from '@prisma/client';
import { UnsignedEvent, getEventHash } from 'nostr-tools';

export function freezeEvent(
  game: Pick<GameStateData, 'id' | 'currentBlock' | 'currentRound'>,
): NostrEvent {
  const currentBlock = game.currentBlock;
  const content = JSON.stringify({
    currentBlock,
    players: powerByPlayer(
      game.currentRound.roundPlayers.map((rp) => rp.player),
    ),
  });
  return {
    content,
    pubkey: requiredEnvVar('NOSTR_PUBLIC_KEY'),
    kind: Kind.REGULAR,
    tags: [
      ['e', game.id, '', 'setup'],
      ['L', 'halving-massacre'],
      ['l', 'freeze', 'halving-massacre'],
      ['block', currentBlock.toString()],
    ],
    created_at: nowInSeconds(),
  };
}

export async function freezeGame(
  gameId: string,
  ctx: GameContext,
): Promise<void> {
  const updatedGame = await ctx.prisma.game.update({
    select: GAME_STATE_SELECT,
    data: { status: Status.FREEZE },
    where: { id: gameId },
  });
  const freezeE = freezeEvent(updatedGame);
  ctx.statePublisher.queue(gameId, getEventHash(freezeE as UnsignedEvent));
  await ctx.outbox.publish(freezeE);
}
