// POST /webhooks/onchain/confirmed

import { ExtendedRequest, requiredEnvVar } from '@lawallet/module';
import { GameContext } from '@src/index';
import { CryptoapisConfirmedTx } from '@src/types/cryptoapis';
import { verifySignature } from '@src/utils';
import type { Response } from 'express';

// eslint-disable-next-line @typescript-eslint/require-await
async function handler<Context extends GameContext>(
  req: ExtendedRequest<Context>,
  res: Response,
) {
  const confirmedTx = req.body as CryptoapisConfirmedTx;
  console.info('--- POST confirmed---');
  console.dir(confirmedTx);

  // Check if the transaction is outgoing
  if (confirmedTx.data.item.direction === 'outgoing') {
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

  const txId = confirmedTx.data.item.transactionId;
  const address = confirmedTx.data.item.address;

  console.info('Transaction info');
  console.dir({
    txId,
    address,
  });
  return res.status(200).send('OK');
}

export default handler;
