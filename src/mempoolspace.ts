import { logger, requiredEnvVar } from '@lawallet/module';
import { PrismaClient, Status } from '@prisma/client';
import { Debugger } from 'debug';
import WebSocket from 'ws';
import handleMempoolTx, {
  MempoolTransaction,
} from '@services/onchain/actions/mempool-tx';
import { OnchainContext } from '@services/onchain/service';
import handleConfirmedTx, {
  TransactionPosition,
} from '@services/onchain/actions/confirmed-tx';

import handleMempoolMultiTx, {
  MempoolTransactions,
} from '@services/onchain/actions/mempool-multi-tx';

const log: Debugger = logger.extend('mempoolspace');

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

/*
const GAME_UPDATE_QUEUE = new Queue<() => Promise<void>>();

setInterval(() => {
  const p = GAME_UPDATE_QUEUE.dequeue();
  if (p) {
    void (async () => {
      await p();
    })();
  }
}, 100);
*/

export function startMempoolSpaceConnection(
  addresses: string[] = [],
  txs: string[] = [],
  prisma: PrismaClient,
) {
  const ws = new WebSocket(requiredEnvVar('MEMPOOL_WS_URL'));

  const subscribeTo: unknown[] = [
    {
      action: 'want',
      data: ['blocks', 'watch-mempool'],
    },
  ];

  subscribeTo.push({ 'track-addresses': addresses });

  txs.forEach((tx) => {
    subscribeTo.push({ 'track-tx': tx });
  });

  ws.on('open', () => {
    // Subscribe to events
    subscribeTo.forEach((event) => {
      console.info('Sending subscription...');
      console.dir(event);
      ws.send(JSON.stringify(event));
    });

    setInterval(() => {
      ws.ping();
    }, 60000);
  });
  ws.on('message', (data: Buffer) => {
    const message: object = JSON.parse(data.toString('utf8')) as object;
    let currentBlock: MsBlock | undefined = undefined;

    console.dir(message);
    if ('blocks' in message) {
      currentBlock = (message.blocks as MsBlock[]).reduce((a, b) =>
        a.height < b.height ? b : a,
      );
    }
    if ('block' in message) {
      currentBlock = message.block as MsBlock;
    }

    const onchainContext: OnchainContext = {
      prisma,
      ws,
    };

    if ('address-transactions' in message) {
      void handleMempoolTx(
        message['address-transactions'] as MempoolTransaction[],
        onchainContext,
      );
    }

    if ('txPosition' in message) {
      void handleConfirmedTx(
        message['txPosition'] as TransactionPosition,
        onchainContext,
      );
    }

    if ('multi-address-transactions' in message) {
      void handleMempoolMultiTx(
        message['multi-address-transactions'] as MempoolTransactions,
        onchainContext,
      );
    }

    if (currentBlock) {
      void (async () => {
        log('New block found: %O', currentBlock);
        await prisma.game.updateMany({
          data: { currentBlock: currentBlock.height },
          where: { status: { not: Status.FINAL } },
        });
      })();
    }
  });
}
