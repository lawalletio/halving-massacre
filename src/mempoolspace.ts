import { requiredEnvVar } from '@lawallet/module';
import { Prisma, PrismaClient, PrismaPromise, Status } from '@prisma/client';
import WebSocket from 'ws';
import { Queue } from '@src/utils';

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

const GAME_UPDATE_QUEUE = new Queue<PrismaPromise<Prisma.BatchPayload>>();

export function startMempoolSpaceConnection(prisma: PrismaClient) {
  const ws = new WebSocket(requiredEnvVar('MEMPOOL_WS_URL'));
  ws.on('open', () => {
    ws.send(JSON.stringify({ action: 'want', data: ['blocks'] }));
    setInterval(() => {
      ws.ping();
    }, 60000);
  });
  ws.on;
  ws.on('message', async (data: Buffer) => {
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
      GAME_UPDATE_QUEUE.enqueue(prisma.game.updateMany({
        data: { currentBlock: currentBlock.height },
        where: { status: { not: Status.FINAL } },
      }));
    }
  });
}
