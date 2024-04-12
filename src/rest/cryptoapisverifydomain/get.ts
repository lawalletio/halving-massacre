import { ExtendedRequest } from '@lawallet/module';
import { GameContext } from '@src/index';
import type { Response } from 'express';

async function handler<Context extends GameContext>(
  _req: ExtendedRequest<Context>,
  res: Response,
) {
  res.status(200).send('cryptoapis-cb-INSERT_GENERATED_KEY');
}

export default handler;
