// POST /webhooks/onchain/mempool-tx

import { ExtendedRequest, requiredEnvVar } from '@lawallet/module';
import { GameContext } from '@src/index';
import { CryptoapisMempoolTx } from '@src/types/cryptoapis';
import { verifySignature } from '@src/utils';
import type { Response } from 'express';

// eslint-disable-next-line @typescript-eslint/require-await
async function handler<Context extends GameContext>(
  req: ExtendedRequest<Context>,
  res: Response,
) {
  const pendingTx = req.body as CryptoapisMempoolTx;
  console.info('--- POST mempool---');
  console.dir(pendingTx);

  // Check if the transaction is outgoing
  if (pendingTx.data.item.direction === 'outgoing') {
    console.info('Outgoing transaction');
    return res.status(200).send('OK');
  }

  // Verify the signature
  if (
    !verifySignature(
      req.body,
      requiredEnvVar('CRYPTOAPIS_LOCAL_SECRET'),
      req.headers['x-signature'] as string,
    )
  ) {
    console.error('Invalid signature');
    return res.status(400).send('Invalid signature');
  }

  const txId = pendingTx.data.item.transactionId;
  const address = pendingTx.data.item.address;
  const amount = parseFloat(pendingTx.data.item.amount) * 100000000 * 1000;

  console.info('Transaction info');
  console.dir({
    txId,
    address,
    amount,
  });

  return res.status(200).send('OK');
}

export default handler;
