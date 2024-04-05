import { Kind, logger, nowInSeconds, requiredEnvVar } from '@lawallet/module';
import { Prisma } from '@prisma/client';
import { Debugger } from 'debug';
import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NostrEvent,
} from '@nostr-dev-kit/ndk';
import { makeZapRequest } from 'nostr-tools/nip57';

const log: Debugger = logger.extend('utils');
const error: Debugger = log.extend('error');

export const WALIAS_RE =
  /(?<username>^[A-Z0-9._-]{1,64})@(?<domain>(?:[A-Z0-9-]{1,63}\.){1,125}[A-Z]{2,63})$/i;
const LUD06_CALLBACK = `${requiredEnvVar('LW_API_ENDPOINT')}/lnurlp/${requiredEnvVar('NOSTR_PUBLIC_KEY')}/callback`;

export enum ZapType {
  TICKET = 'TICKET',
  POWER = 'POWER',
}

export type ZapTicketContent = {
  type: ZapType.TICKET;
  gameId: string;
  ticketId: string;
};

export type ZapPowerContent = {
  type: ZapType.POWER;
  gameId: string;
  walias: string;
};

export const GAME_STATE_SELECT = Prisma.validator<Prisma.GameSelect>()({
  id: true,
  currentBlock: true,
  nextFreeze: true,
  nextMassacre: true,
  status: true,
  roundLength: true,
  freezeDuration: true,
  currentRound: {
    select: {
      roundPlayers: {
        select: { player: { select: { walias: true, power: true } } },
        orderBy: { player: { power: Prisma.SortOrder.desc } },
        take: 100,
      },
    },
  },
  _count: { select: { players: true } },
});
export type GameStateData = Prisma.GameGetPayload<{
  select: typeof GAME_STATE_SELECT;
}>;

/**
 * Generate the event of the game state
 *
 * @param game state to be published
 * @param lastModifier the id of the event that modified the state last
 * @return the nostr event of the game state
 */
export function gameStateEvent(
  game: GameStateData,
  lastModifier: string,
): NostrEvent {
  const { currentRound, ...rest } = game;
  const playerEntries = currentRound.roundPlayers.map((rp) => [
    rp.player.walias,
    rp.player.power,
  ]);
  const top100Players = Object.fromEntries(playerEntries) as Record<
    string,
    string
  >;
  const content = JSON.stringify({
    ...rest,
    top100Players,
    playerCount: game._count.players,
  });
  return {
    content,
    pubkey: requiredEnvVar('NOSTR_PUBLIC_KEY'),
    kind: Kind.PARAMETRIZED_REPLACEABLE,
    tags: [
      ['d', `state:${game.id}`],
      ['e', game.id, '', 'setup'],
      ['e', lastModifier, '', 'lastModifier'],
      ['L', 'halving-massacre'],
      ['l', 'state', 'halving-massacre'],
      ['block', game.currentBlock.toString()],
    ],
    created_at: nowInSeconds(),
  };
}

/**
 * Generate the event for a power receipt
 *
 * @param game state
 * @param amount being added to the power
 * @param walias who added the power
 * @param zapReceiptId that added the power
 * @return the power receipt event
 */
export function powerReceiptEvent(
  game: Pick<GameStateData, 'id' | 'currentBlock'>,
  amount: number,
  walias: string,
  zapReceiptId: string,
): NostrEvent {
  const content = JSON.stringify({
    amount,
    player: walias,
  });
  return {
    content,
    pubkey: requiredEnvVar('NOSTR_PUBLIC_KEY'),
    kind: Kind.REGULAR,
    tags: [
      ['e', game.id, '', 'setup'],
      ['e', zapReceiptId, '', 'zap-receipt'],
      ['L', 'halving-massacre'],
      ['l', 'power-receipt', 'halving-massacre'],
      ['i', walias],
      ['amount', amount.toString()],
      ['block', game.currentBlock.toString()],
    ],
    created_at: nowInSeconds(),
  };
}

/**
 * Generate the event for a ticket
 *
 * @param game state
 * @param walias who bought the ticket
 * @param zapReceiptId that paid for the ticket
 * @return the ticket event
 */
export function ticketEvent(
  game: Pick<GameStateData, 'id' | 'currentBlock'>,
  walias: string,
  zapReceiptId: string,
): NostrEvent {
  const content = JSON.stringify({ player: walias });
  return {
    content,
    pubkey: requiredEnvVar('NOSTR_PUBLIC_KEY'),
    kind: Kind.REGULAR,
    tags: [
      ['e', game.id, '', 'setup'],
      ['e', zapReceiptId, '', 'zap-receipt'],
      ['L', 'halving-massacre'],
      ['l', 'ticket', 'halving-massacre'],
      ['i', walias],
      ['block', game.currentBlock.toString()],
    ],
    created_at: nowInSeconds(),
  };
}

export type Lud06Response = {
  pr: string;
  routes: never[];
};

/**
 * Validates that a given input is a valid walias
 *
 * @param input to be validated
 * @return the walias string if it was valid
 * @throws Error if the input was not a valid walias address
 */
export function validWalias(input: unknown): string {
  if ('string' !== typeof input) {
    throw new Error('walias must be a string');
  }
  if (254 < input.length || !WALIAS_RE.test(input)) {
    throw new Error('walias must be a valid internet identifier');
  }
  return input;
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
    profile: requiredEnvVar('NOSTR_PUBLIC_KEY'),
    event,
    amount,
    comment,
    relays: requiredEnvVar('NOSTR_RELAYS').split(','),
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
  eventId: string,
  amount: number,
  comment: string,
): Promise<Lud06Response> {
  const zr = await signedZapRequest(Number(amount), eventId, comment);
  let res;
  try {
    res = await fetch(
      `${LUD06_CALLBACK}?amount=${amount.toString()}&comment=${comment}&nostr=${JSON.stringify(zr)}`,
    );
  } catch (err: unknown) {
    error('Error generating invoice: %O', err);
    throw new Error('Error generating invoice');
  }
  if (res.status < 200 || 300 <= res.status) {
    error('lud06 request returned non success status %O', res);
    throw new Error('Error generating invoice');
  }
  return (await res.json()) as Lud06Response;
}
