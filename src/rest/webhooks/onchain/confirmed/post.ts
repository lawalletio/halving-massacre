// POST /webhooks/onchain/confirmed

import { ExtendedRequest, requiredEnvVar } from '@lawallet/module';
import { GameContext } from '@src/index';
import { BlockCypherNotification } from '@src/types/blockcypher';
import type { Response } from 'express';

interface AddressTxOutput {
  txid: string;
  address: string;
  vout: number;
  amount: number;
}

// eslint-disable-next-line @typescript-eslint/require-await
async function handler<Context extends GameContext>(
  req: ExtendedRequest<Context>,
  res: Response,
) {
  const confirmedTx = req.body as BlockCypherNotification;

  // Verify Blockcypher x-eventid
  if (requiredEnvVar('BLOCKCYPHER_X_EVENTID') !== req.headers['x-eventid']) {
    return res.status(401).send('Unauthorized');
  }

  const addressTxOutputs: AddressTxOutput[] = confirmedTx.outputs.map(
    (output, k) => {
      return {
        txid: confirmedTx.hash,
        address: output.addresses[0] as string,
        vout: k,
        amount: output.value,
      };
    },
  );

  console.dir('addressTxOutputs: ');
  console.dir(addressTxOutputs);

  // Iterate through each address
  // addressTxOutputs
  // Look for txid in db
  // If exists
  // If confirmed. Add Power to user and update Tx

  // If doesnt exist
  // Look for address in db
  // Add Power to user and update Tx

  return res.status(200).send('OK');
}

export default handler;
