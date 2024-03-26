import { DefaultContext, ExtendedRequest } from '@lawallet/module';
import type { Response } from 'express';

function handler<Context extends DefaultContext>(
  _req: ExtendedRequest<Context>,
  res: Response,
) {
  res.status(200).json({ message: 'Test POST response' }).send();
}

export default handler;
