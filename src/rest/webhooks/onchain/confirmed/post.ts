// POST /webhooks/onchain/confirmed

import { ExtendedRequest } from '@lawallet/module';
import { GameContext } from '@src/index';
import { CryptoapisConfirmedTx } from '@src/types/cryptoapis';
import type { Response } from 'express';

async function handler<Context extends GameContext>(
  req: ExtendedRequest<Context>,
  res: Response,
) {
  const confirmedTx = req.body as CryptoapisConfirmedTx;
  console.info('--- POST confirmed---');
  console.dir(confirmedTx);

  const txId = confirmedTx.data.item.transactionId;
  const address = confirmedTx.data.item.address;

  console.info('Transaction info');
  console.dir({
    txId,
    address,
  });
  res.status(200).send('OK');
}

export default handler;
