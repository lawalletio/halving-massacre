import { logger, requiredEnvVar } from '@lawallet/module';
import { Debugger } from 'debug';
import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NostrEvent,
} from 'node_modules/@nostr-dev-kit/ndk/dist';
import { makeZapRequest } from 'nostr-tools/nip57';

const log: Debugger = logger.extend('utils');
const error: Debugger = log.extend('error');

export const LUD16_RE =
  /(?<username>^[A-Z0-9._%+-]{1,64})@(?<domain>(?:[A-Z0-9-]{1,63}\.){1,125}[A-Z]{2,63})$/i;
const LUD06_CALLBACK = `${requiredEnvVar('BTC_GATEWAY_PUBLIC_KEY')}/lnurlp/${requiredEnvVar('NOSTR_PUBLIC_KEY')}/callback`;

export type Lud06Response = {
  pr: string;
  routes: never[];
};

/**
 * Validates that a given input is a valid lud16
 *
 * @param input to be validated
 * @return the lud16 string if it was valid
 * @throws Error if the input was not a valid lud16 address
 */
export function validLud16(input: unknown): string {
  if ('string' !== typeof input) {
    throw new Error('lud16 must be a string');
  }
  const lud16 = input;
  if (254 < lud16.length || !LUD16_RE.test(lud16)) {
    throw new Error('lud16 must be a valid internet identifier');
  }
  return lud16;
}

/**
 * Generates a zap request and signs it
 *
 * @param amount to make the zr for
 * @param event id to include in the tag
 * @param comment to add on the zap request
 * @return the signed zap request event
 */
async function signedZapRequest(
  amount: number,
  event: string,
  comment: string,
): Promise<NostrEvent> {
  const zr = makeZapRequest({
    profile: requiredEnvVar('BTC_GATEWAY_PUBLIC_KEY'),
    event,
    amount,
    comment,
    //TODO
    relays: [],
  });
  const pubkey = requiredEnvVar('NOSTR_PUBLIC_KEY');
  const signer = new NDKPrivateKeySigner(requiredEnvVar('NOSTR_PRIVATE_KEY'));
  const ndkZr = new NDKEvent(new NDK({ signer }), { pubkey, ...zr });
  await ndkZr.sign();
  return await ndkZr.toNostrEvent();
}

/**
 * Generates an invoice for our own account and return the response
 *
 * @param amount to generate the invoice for
 * @param comment for the invoice
 * @return an object containing the invoice in the `pr` key
 * @throws Error if the request failed
 */
export async function getInvoice(
  gameId: string,
  amount: string,
  comment: string,
): Promise<Lud06Response> {
  const zr = signedZapRequest(Number(amount), gameId, comment);
  let res;
  try {
    res = await fetch(
      `${LUD06_CALLBACK}?amount=${amount}&comment=${comment}&zr=${JSON.stringify(zr)}`,
    );
  } catch (err: unknown) {
    error('Error generating invoice: %O', err);
    throw new Error('Error generating invoice');
  }
  if (res.status < 200 || 300 <= res.status) {
    error('lud16 request returned non sucess status %O', res);
    throw new Error('Error generating invoice');
  }
  return (await res.json()) as Lud06Response;
}