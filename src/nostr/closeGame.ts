import {
  EventHandler,
  Kind,
  logger,
  nowInSeconds,
  requiredEnvVar,
} from '@lawallet/module';
import { NDKFilter, NDKKind, NostrEvent } from '@nostr-dev-kit/ndk';
import { Status } from '@prisma/client';
import { GameContext } from '@src/index';
import { GameStateData } from '@src/utils';
import { Debugger } from 'debug';
import { UnsignedEvent, getEventHash } from 'nostr-tools';

const log: Debugger = logger.extend('nostr:closeGame');
const debug: Debugger = log.extend('debug');

const filter: NDKFilter = {
  kinds: [Kind.REGULAR as unknown as NDKKind],
  '#p': [requiredEnvVar('NOSTR_PUBLIC_KEY')],
  '#t': ['close-game'],
  since: Math.floor(Date.now() / 1000) - 86000,
  until: Math.floor(Date.now() / 1000) + 86000,
};

function closeEvent(
  game: Pick<GameStateData, 'id' | 'currentBlock'>,
): NostrEvent {
  return {
    content: '',
    pubkey: requiredEnvVar('NOSTR_PUBLIC_KEY'),
    kind: Kind.REGULAR,
    tags: [
      ['e', game.id, '', 'setup'],
      ['L', 'halving-massacre'],
      ['l', 'close', 'halving-massacre'],
      ['block', game.currentBlock.toString()],
    ],
    created_at: nowInSeconds(),
  };
}

function getHandler<Context extends GameContext>(ctx: Context): EventHandler {
  return async (event: NostrEvent): Promise<void> => {
    debug('Received event %s', event.id);
    const gameId = event.tags
      .find((t) => 'e' === t[0] && 'setup' === t[3])
      ?.at(1);
    if (!gameId) {
      log('Received event without gameId');
      return;
    }
    const game = await ctx.prisma.game.findUnique({
      select: { id: true, finalBlock: true },
      where: { id: gameId, poolPubKey: event.pubkey, status: Status.SETUP },
    });
    if (!game) {
      log('No setup game for id: %s and author %s', gameId, event.pubkey);
      return;
    }
    log('Closing game %s', game.id);
    const updatedGame = await ctx.prisma.game.update({
      select: { id: true, currentBlock: true },
      data: { status: Status.CLOSED },
      where: { id: game.id },
    });
    const closeE = closeEvent(updatedGame);
    ctx.statePublisher.queue(game.id, getEventHash(closeE as UnsignedEvent));
    await ctx.outbox.publish(closeE);
  };
}

export { filter, getHandler };
