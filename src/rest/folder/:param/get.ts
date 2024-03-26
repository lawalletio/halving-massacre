import { DefaultContext, ExtendedRequest } from '@lawallet/module';
import type { Response } from 'express';

function handler<Context extends DefaultContext = DefaultContext>(
  _req: ExtendedRequest<Context>,
  res: Response,
) {
  res.status(200).json({ message: 'Test GET response' }).send();
}

export default handler;
