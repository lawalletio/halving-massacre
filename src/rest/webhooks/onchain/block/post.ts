// POST /webhooks/onchain/block

import { ExtendedRequest, requiredEnvVar } from '@lawallet/module';
import { GameContext } from '@src/index';
import type { Response } from 'express';

// eslint-disable-next-line @typescript-eslint/require-await
async function handler<Context extends GameContext>(
  req: ExtendedRequest<Context>,
  res: Response,
) {
  console.info('--- New block---');

  // Verify Blockcypher x-eventid
  if (requiredEnvVar('BLOCKCYPHER_X_EVENTID') !== req.headers['x-eventid']) {
    return res.status(401).send('Unauthorized');
  }

  return res.status(200).send('OK');
}

export default handler;
