// POST /webhooks/onchain/mempool-tx

import { ExtendedRequest } from '@lawallet/module';
import { GameContext } from '@src/index';
import { CryptoapisMempoolTx } from '@src/types/cryptoapis';
import type { Response } from 'express';

async function handler<Context extends GameContext>(
  req: ExtendedRequest<Context>,
  res: Response,
) {
  const pendingTx = req.body as CryptoapisMempoolTx;
  console.info('--- POST mempool---');
  console.dir(pendingTx);

  const txId = pendingTx.data.item.transactionId;
  const address = pendingTx.data.item.address;
  const amount = parseFloat(pendingTx.data.item.amount) * 100000000 * 1000000;

  console.info('Transaction info');
  console.dir({
    txId,
    address,
    amount,
  });

  res.status(200).send('OK');
}

export default handler;
