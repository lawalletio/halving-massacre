import { Kind, logger, nowInSeconds, requiredEnvVar } from '@lawallet/module';
import { Player, Prisma, Status } from '@prisma/client';
import { Debugger } from 'debug';
import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NostrEvent,
} from '@nostr-dev-kit/ndk';
import { makeZapRequest } from 'nostr-tools/nip57';
import { bucketize } from '@lib/lottery';

const log: Debugger = logger.extend('utils');
const error: Debugger = log.extend('error');
const warn: Debugger = log.extend('warn');

export const WALIAS_RE =
  /(?<username>^[A-Z0-9._-]{1,64})@(?<domain>(?:[A-Z0-9-]{1,63}\.){1,125}[A-Z]{2,63})$/i;

export const SURVIVOR_MESSAGE = 'You survived! For now...';

export const VALID_POWER_STATUSES: Status[] = [
  Status.SETUP,
  Status.CLOSED,
  Status.INITIAL,
  Status.NORMAL,
];

export enum ZapType {
  TICKET = 'TICKET',
  POWER = 'POWER',
}

export enum PowerType {
  LIGHTNING = 'LIGHTNING',
  ONCHAIN = 'ONCHAIN',
  MASSACRE = 'MASSACRE',
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
  message: string;
};

export type MassacreSchedule = {
  height: number;
  survivors: number;
  freezeHeight: number;
  nextMassacre: number | null;
};

export const GAME_STATE_SELECT = Prisma.validator<Prisma.GameSelect>()({
  id: true,
  currentBlock: true,
  status: true,
  currentPool: true,
  players: {
    select: { walias: true, power: true, deathRoundId: true },
    orderBy: { power: Prisma.SortOrder.desc },
  },
  currentRound: {
    select: {
      id: true,
      massacreHeight: true,
      number: true,
      freezeHeight: true,
      nextRound: { select: { id: true, number: true } },
      prevRound: { select: { id: true, number: true } },
      _count: { select: { roundPlayers: true } },
    },
  },
});
export type GameStateData = Prisma.GameGetPayload<{
  select: typeof GAME_STATE_SELECT;
}>;

export type PlayerData = {
  walias: string;
  power: bigint;
  deathRoundId: string | null;
};

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
  const { currentRound, currentPool, players, ...rest } = game;
  const [alive, dead] = players.reduce<[PlayerData[], PlayerData[]]>(
    (result, value) => {
      result[value.deathRoundId === null ? 0 : 1].push(value);
      return result;
    },
    [[], []],
  );
  const alivePlayers = powerByPlayer(alive);
  const content = JSON.stringify({
    ...rest,
    nextMassacre: currentRound.massacreHeight,
    nextFreeze: currentRound.freezeHeight,
    currentPool: Number(currentPool),
    players: alivePlayers,
    playerCount: currentRound._count.roundPlayers,
    deadPlayers: powerByPlayer(dead),
    buckets: bucketize(alivePlayers),
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

export const PROFILE_SELECT = Prisma.validator<Prisma.PlayerSelect>()({
  walias: true,
  power: true,
  deathRoundId: true,
  deathRound: { select: { number: true } },
  game: { select: { id: true, currentBlock: true } },
  roundPlayers: {
    select: {
      maxZap: true,
      zapped: true,
      zapCount: true,
      round: { select: { number: true } },
    },
    orderBy: {
      round: { number: Prisma.SortOrder.asc },
    },
  },
});
export type Profile = Prisma.PlayerGetPayload<{
  select: typeof PROFILE_SELECT;
}>;

/**
 * Creates a profile event
 *
 * @param player with the information necesary for the event
 * @param lastModifier the id of the event that modified this profile
 * @return the profile nostr event
 */
export function profileEvent(
  player: Profile,
  lastModifier: string,
): NostrEvent {
  const rounds = player.roundPlayers.map((rp) => ({
    maxZap: Number(rp.maxZap),
    zapped: Number(rp.zapped),
    zapCount: rp.zapCount,
    number: rp.round.number,
  }));
  const content = JSON.stringify({
    walias: player.walias,
    power: Number(player.power),
    deathRound: player.deathRound?.number ?? null,
    rounds,
  });
  return {
    content,
    pubkey: requiredEnvVar('NOSTR_PUBLIC_KEY'),
    kind: Kind.PARAMETRIZED_REPLACEABLE,
    tags: [
      ['d', `profile:${player.game.id}:${player.walias}`],
      ['e', player.game.id, '', 'setup'],
      ['e', lastModifier, '', 'lastModifier'],
      ['L', 'halving-massacre'],
      ['l', 'profile', 'halving-massacre'],
      ['block', player.game.currentBlock.toString()],
    ],
    created_at: nowInSeconds(),
  };
}

/**
 * Build a dictionaty of players with their powers
 *
 * @param players list of player with walias and power, we assume it to be
 * sorted
 * @param topN optional param to indicate how many results we want to provide
 * @return a dictionary where the keys are the waliases and the value is power
 */
export function powerByPlayer(
  players: Pick<Player, 'walias' | 'power'>[],
  topN?: number,
): { [key: string]: number } {
  if (topN && topN < players.length) {
    players = players.slice(0, topN);
  }
  return Object.fromEntries(players.map((p) => [p.walias, Number(p.power)]));
}

/**
 * Generate the event for a power receipt
 *
 * @param game state
 * @param amount being added to the power
 * @param walias who added the power
 * @param zapReceiptId that added the power
 * @param type of the power
 * @return the power receipt event
 */
export function powerReceiptEvent(
  game: Pick<GameStateData, 'id' | 'currentBlock'>,
  amount: number,
  zapReceiptContent: Pick<ZapPowerContent, 'message' | 'walias'>,
  zapReceiptId: string,
  type: PowerType = PowerType.LIGHTNING,
): NostrEvent {
  const { message, walias } = zapReceiptContent;
  const content = JSON.stringify({
    type,
    amount,
    message,
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
 * Generate the event for a refund
 *
 * @param game state
 * @param amount being added to the power
 * @param walias who added the power
 * @param zapReceiptId that added the power
 * @return the power receipt event
 */
export function refundEvent(
  game: Pick<GameStateData, 'id' | 'currentBlock'>,
  amount: number,
  zapReceiptContent: Pick<ZapPowerContent, 'message' | 'walias'>,
  zapReceiptId: string,
): NostrEvent {
  const { message, walias } = zapReceiptContent;
  const content = JSON.stringify({
    amount,
    message,
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
      ['l', 'refund', 'halving-massacre'],
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

export function startEvent(
  game: Pick<GameStateData, 'id' | 'currentBlock'>,
  massacreSchedule: MassacreSchedule[],
): NostrEvent {
  const content = JSON.stringify({ massacreSchedule });
  return {
    content,
    pubkey: requiredEnvVar('NOSTR_PUBLIC_KEY'),
    kind: Kind.REGULAR,
    tags: [
      ['e', game.id, '', 'setup'],
      ['L', 'halving-massacre'],
      ['l', 'start', 'halving-massacre'],
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
  profile: string,
  amount: number,
  event: string,
  comment: string,
): Promise<NostrEvent> {
  const zr = makeZapRequest({
    profile,
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
 * Build lud06 callback
 *
 * @param pubKey lawallet user where the funds will be accredited
 * @param amount to create the invoice for
 * @param comment to include in the lud06
 * @param zapRequest stringify zapRequest
 */
function lud06Callback(
  pubKey: string,
  amount: number,
  comment: string,
  zapRequest: string,
): string {
  comment = encodeURIComponent(comment);
  zapRequest = encodeURIComponent(zapRequest);
  return `${requiredEnvVar('LW_API_ENDPOINT')}/lnurlp/${pubKey}/callback?amount=${amount.toString()}&comment=${comment}&nostr=${zapRequest}`;
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
  poolPubKey: string,
  amount: number,
  content: string,
  comment: string = '',
): Promise<Lud06Response> {
  const zr = await signedZapRequest(
    poolPubKey,
    Number(amount),
    eventId,
    content,
  );
  let res;
  try {
    res = await fetch(
      lud06Callback(poolPubKey, amount, comment, JSON.stringify(zr)),
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

export function validSafePositive(n: unknown): number | null {
  if ('number' === typeof n && Number.isSafeInteger(n) && 0 <= n) {
    return n;
  }
  warn('%O is not a valid safe positive');
  return null;
}
