import { EventHandler, Kind, logger, requiredEnvVar } from '@lawallet/module';
import { NDKFilter, NDKKind, NostrEvent } from '@nostr-dev-kit/ndk';
import { Prisma, Status } from '@prisma/client';
import { GameContext } from '@src/index';
import { MassacreSchedule, startEvent, validSafePositive } from '@src/utils';
import { Debugger } from 'debug';
import { UnsignedEvent, getEventHash } from 'nostr-tools';

const log: Debugger = logger.extend('nostr:startGame');
const debug: Debugger = log.extend('debug');
const warn: Debugger = log.extend('warn');

const filter: NDKFilter = {
  kinds: [Kind.REGULAR as unknown as NDKKind],
  '#p': [requiredEnvVar('NOSTR_PUBLIC_KEY')],
  '#t': ['start-game'],
  since: Math.floor(Date.now() / 1000) - 86000,
  until: Math.floor(Date.now() / 1000) + 86000,
};

type StartEventContent = {
  massacreSchedule: MassacreSchedule[];
};

function validateContent(content: string): StartEventContent | null {
  let obj: object;
  try {
    obj = JSON.parse(content) as object;
  } catch (err: unknown) {
    warn('Error parsing content: %O', err);
    return null;
  }
  if (!('massacreSchedule' in obj) || !Array.isArray(obj.massacreSchedule)) {
    warn('Content must contain massacreSchedule array');
    return null;
  }
  if ((obj.massacreSchedule as Array<unknown>).length === 0) {
    warn('Empty schedule not allowed');
    return null;
  }
  for (const el of obj.massacreSchedule as Array<unknown>) {
    if (
      'object' !== typeof el ||
      null === el ||
      !('height' in el) ||
      null === validSafePositive(el.height) ||
      !('survivors' in el) ||
      null === validSafePositive(el.survivors) ||
      !('freezeHeight' in el) ||
      null === validSafePositive(el.freezeHeight) ||
      !('nextMassacre' in el) ||
      (el.nextMassacre !== null && null === validSafePositive(el.nextMassacre))
    ) {
      warn('Invalid element: %O', el);
      return null;
    }
  }
  return obj as StartEventContent;
}

type NextRoundInput = Prisma.RoundUpdateOneWithoutPrevRoundNestedInput;

/**
 * Recursively create a linked list of round create querys for prisma
 *
 * @param serialized the list of massacre schedules
 * @param gameId to create the rounds on
 * @param nextRound a node
 * @return the root of the linked list
 */
function deserializeSchedule(
  serialized: MassacreSchedule[],
  gameId: string,
  nextRound?: NextRoundInput,
): NextRoundInput {
  if (serialized.length === 0) {
    return nextRound!;
  }
  const { height, survivors, freezeHeight } = serialized.pop()!;
  const input: NextRoundInput = {
    create: {
      massacreHeight: height,
      freezeHeight,
      survivors,
      number: serialized.length + 1,
      game: { connect: { id: gameId } },
    },
  };
  if (nextRound) {
    input.create!.nextRound = nextRound;
  }
  return deserializeSchedule(serialized, gameId, input);
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
    const content = validateContent(event.content);
    if (!content) {
      log('Received invalid content: %O', event.content);
      return;
    }
    const game = await ctx.prisma.game.findUnique({
      select: { id: true, finalBlock: true },
      where: { id: gameId, poolPubKey: event.pubkey, status: Status.CLOSED },
    });
    if (!game) {
      log('No closed game for id: %s and author %s', gameId, event.pubkey);
      return;
    }
    const schedule = content.massacreSchedule;
    if (schedule.at(-1)!.height !== game.finalBlock) {
      log(
        'Received invalid schedule, final height must be same as final block: %O',
        schedule,
      );
      return;
    }
    const [firstRound, ...restRounds] = schedule;
    const updatedGame = await ctx.prisma.game.update({
      select: { id: true, currentBlock: true },
      data: {
        status: Status.INITIAL,
        currentRound: {
          update: {
            massacreHeight: firstRound!.height,
            freezeHeight: firstRound!.freezeHeight,
            survivors: firstRound!.survivors,
            nextRound: deserializeSchedule(restRounds, game.id),
          },
        },
      },
      where: { id: game.id },
    });
    const startE = startEvent(updatedGame, schedule);
    ctx.statePublisher.queue(game.id, getEventHash(startE as UnsignedEvent));
    await ctx.outbox.publish(startE);
  };
}

export { filter, getHandler };
