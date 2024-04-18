import { logger, requiredEnvVar } from '@lawallet/module';
import { Status } from '@prisma/client';
import { Debugger } from 'debug';
import WebSocket from 'ws';
import { GAME_STATE_SELECT } from '@src/utils';
import { GameContext } from '@src/index';
import { freezeGame } from '@lib/freeze';
import { applyFinalMassacre, applyMassacre } from '@lib/massacre';

const log: Debugger = logger.extend('mempoolspace');
const warn: Debugger = logger.extend('warn');

export type MsBlock = {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  bits: number;
  nonce: number;
  difficulty: number;
  merkle_root: string;
  tx_count: number;
  size: number;
  weight: number;
  previousblockhash: string;
  mediantime: number;
  stale: boolean;
  extras: {
    [key: string]:
      | number
      | string
      | number[]
      | null
      | { [key: string]: number | string };
  };
};

export function startMempoolSpaceConnection(ctx: GameContext) {
  const ws = new WebSocket(requiredEnvVar('MEMPOOL_WS_URL'));
  ws.on('open', () => {
    ws.send(JSON.stringify({ action: 'want', data: ['blocks'] }));
    setInterval(() => {
      ws.ping();
    }, 60000);
  });
  ws.on('message', (data: Buffer) => {
    const message: object = JSON.parse(data.toString('utf8')) as object;
    let currentBlock: MsBlock | undefined = undefined;
    if ('blocks' in message) {
      currentBlock = (message.blocks as MsBlock[]).reduce((a, b) =>
        a.height < b.height ? b : a,
      );
    }
    if ('block' in message) {
      currentBlock = message.block as MsBlock;
    }
    if (currentBlock) {
      void (async () => {
        log('New block found: %O', currentBlock);
        await ctx.prisma.game.updateMany({
          data: { currentBlock: currentBlock.height },
          where: { status: { not: Status.FINAL } },
        });
        const games = await ctx.prisma.game.findMany({
          select: GAME_STATE_SELECT,
          where: {
            OR: [
              {
                status: { in: [Status.INITIAL, Status.NORMAL] },
                currentRound: { freezeHeight: currentBlock.height },
              },
              {
                status: Status.FREEZE,
                currentRound: { massacreHeight: currentBlock.height },
              },
            ],
          },
        });
        const promises: Promise<void>[] = [];
        for (const game of games) {
          switch (game.status) {
            case Status.INITIAL:
            case Status.NORMAL:
              promises.push(freezeGame(game.id, ctx));
              break;
            case Status.FREEZE:
              if (game.currentRound.nextRound) {
                promises.push(applyMassacre(game, currentBlock, ctx));
              } else {
                promises.push(applyFinalMassacre(game, currentBlock, ctx));
              }
              break;
            default:
              warn('Impossible game status');
              break;
          }
        }
        await Promise.allSettled(promises);
      })();
    }
  });
}
