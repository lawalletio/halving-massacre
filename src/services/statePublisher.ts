import { Outbox, logger } from '@lawallet/module';
import { PrismaClient } from '@prisma/client';
import {
  GAME_STATE_SELECT,
  PROFILE_SELECT,
  gameStateEvent,
  profileEvent,
} from '@src/utils';
import { Debugger } from 'debug';

const log: Debugger = logger.extend('services:statePublisher');
const error: Debugger = log.extend('error');
const warn: Debugger = log.extend('warn');
const debug: Debugger = log.extend('debug');

const INTERVAL = 1200; // A bit over a second

type PublishInfo = {
  gameId: string;
  shouldPublish: boolean;
  lastModifier: string;
  profiles: { walias: string; lastModifier: string }[];
};

function publishState(publisher: StatePublisher) {
  void publisher.publishQueued();
}

export class StatePublisher {
  #shouldPublishMap: {
    [key: string]: PublishInfo;
  };
  #outbox: Outbox;
  #prisma: PrismaClient;
  #publishing: boolean;

  constructor(
    outbox: Outbox,
    prisma: PrismaClient,
    interval: number = INTERVAL,
  ) {
    this.#shouldPublishMap = {};
    this.#outbox = outbox;
    this.#prisma = prisma;
    this.#publishing = false;
    setInterval(publishState, interval, this);
  }

  /**
   * Queue a game to publish state for
   *
   * @param gameId id of the game to publish state for
   * @param lastModifier string that identifies the last modifier
   */
  queue(gameId: string, lastModifier: string): void {
    const tracked = this.#shouldPublishMap[gameId];
    if (tracked) {
      tracked.shouldPublish = true;
      tracked.lastModifier = lastModifier;
    } else {
      this.#shouldPublishMap[gameId] = {
        gameId,
        shouldPublish: true,
        lastModifier,
        profiles: [],
      };
    }
  }

  queueProfile(gameId: string, walias: string, lastModifier: string): void {
    this.queue(gameId, lastModifier);
    this.#shouldPublishMap[gameId]!.profiles.push({ walias, lastModifier });
  }

  /**
   * Publish all the states that are queued
   */
  async publishQueued(): Promise<void> {
    if (this.#publishing) {
      debug('Already publishing, going to sleep');
      return;
    }
    this.#publishing = true;
    const publishables = Object.values(this.#shouldPublishMap).filter(
      (e) => e.shouldPublish,
    );
    const games = await this.#prisma.game.findMany({
      select: {
        ...GAME_STATE_SELECT,
        players: {
          select: PROFILE_SELECT,
        },
      },
      where: {
        id: { in: publishables.map((p) => p.gameId) },
      },
    });
    try {
      for (const game of games) {
        debug('Publishing state for game %s', game.id);
        const toPublish = this.#shouldPublishMap[game.id]!;
        const profilePublications: Promise<void>[] = [];
        let profile: PublishInfo['profiles'][0] | undefined;
        while (undefined !== (profile = toPublish.profiles.pop())) {
          const player = game.players.find((p) => profile!.walias === p.walias);
          if (!player) {
            error(
              'Player %s not found on game %s',
              profile.walias,
              toPublish.gameId,
            );
            continue;
          }
          debug('Publishing profile for %s on game %s', player.walias, game.id);
          profilePublications.push(
            this.#outbox.publish(profileEvent(player, profile.lastModifier)),
          );
        }
        const results = await Promise.allSettled([
          this.#outbox.publish(gameStateEvent(game, toPublish.lastModifier)),
          ...profilePublications,
        ]);
        if (results.some((r) => 'rejected' === r.status)) {
          warn('Some events failed when publishing state for game %s', game.id);
        } else {
          debug('Correctly published state for game %s', game.id);
          toPublish.shouldPublish = false;
        }
      }
    } catch (err: unknown) {
      error('Unexpected error publishing game states: %O', err);
    } finally {
      this.#publishing = false;
    }
  }
}
