import { ExtendedRequest, logger } from '@lawallet/module';
import { type GameContext } from '../../../../index';
import { Debugger } from 'debug';
import type { Response } from 'express';
import { Prisma, PrismaClient, Status } from '@prisma/client';
import { LUD16_RE, getInvoice, validLud16 } from '../../../../utils';

const log: Debugger = logger.extend('rest:game:gameId:ticket:post');
const trace: Debugger = log.extend('trace');
const debug: Debugger = log.extend('debug');
const warn: Debugger = log.extend('warn');

const VALID_STATUSES: Status[] = [Status.SETUP, Status.INITIAL];

type RequestBody = {
  lud16: string;
};

/**
 *  Validates an unknown input if it has everything we expect in the
 *  body of this request
 *
 *  @param data to be validated
 *  @returns the body if it passed all validations
 *  @throws Error on validation fail
 */
function validateBody(data: unknown): RequestBody {
  trace('received body: %O', data);
  if ('object' !== typeof data || null === data) {
    debug('Invalid body (null or not object)');
    throw new Error('Invalid body (null or not object)');
  }
  if (!('lud16' in data)) {
    debug('Missing lud16');
    throw new Error('Missing property lud16');
  }
  try {
    return { lud16: validLud16(data.lud16) };
  } catch (err: unknown) {
    debug(err);
    throw err;
  }
}

/**
 * Checks if the domain returns a valid lud06 response for the user
 *
 * @param lud16 that we assume was previously validated as a valid address
 * @returns true if the domain returned a valid lud06 response false otherwise
 */
async function isServerActive(lud16: string): Promise<boolean> {
  const { username, domain } = lud16.match(LUD16_RE)!.groups as {
    username: string;
    domain: string;
  };
  let res;
  try {
    res = await fetch(`https://${domain}/.well-known/lnurlp/${username}`);
  } catch (err: unknown) {
    warn('Error fetching %s: %O', lud16, err);
    return false;
  }
  if (res.status < 200 || 300 <= res.status) {
    log('lud16 request returned non success status %O', res.status);
    return false;
  }
  const body = await res.json();
  if ('object' !== typeof body || null === body) {
    log('lud16 request invalid body %O', body);
    return false;
  }
  if (
    'status' in body &&
    'string' === typeof body.status &&
    'ERROR' === body.status.toUpperCase()
  ) {
    log('lud16 request returned status error: %O', body);
    return false;
  }
  return (
    'tag' in body &&
    'payRequest' === body.tag &&
    'callback' in body &&
    'string' === typeof body.callback
  );
}

/**
 * Generates a ticket for a lud16 in a given game
 *
 * Only creates a new ticket if there is no ticket for that lud16 previously
 *
 * @param prisma client
 * @param gameId where the ticket will be created
 * @param lud16 for whom the ticket is
 * @return the id of the ticket
 */
async function generateTicket(
  prisma: PrismaClient,
  gameId: string,
  lud16: string,
): Promise<string> {
  const ticket = await prisma.ticket.upsert({
    select: { id: true },
    create: { lud16, game: { connect: { id: gameId } } },
    update: {},
    where: { gameId_lud16: { gameId, lud16 } },
  });
  return ticket.id;
}

const GAME_SELECT = Prisma.validator<Prisma.GameSelect>()({
  id: true,
  ticketPrice: true,
  status: true,
  players: {
    select: { lud16: true },
  },
});
type GameInfo = Prisma.GameGetPayload<{
  select: typeof GAME_SELECT;
}>;

/**
 * Finds a game by id, also returns if the lud16 is already a player
 *
 * @param prisma client
 * @param id of the game to search for
 * @param lud16 of the player we want to check
 * @return the game info if preset or null
 */
async function findGame(
  prisma: PrismaClient,
  id: string,
  lud16: string,
): Promise<GameInfo | null> {
  return await prisma.game.findUnique({
    select: {
      ...GAME_SELECT,
      players: {
        ...GAME_SELECT.players,
        where: { lud16 },
      },
    },
    where: { id, NOT: { status: Status.FINAL } },
  });
}

async function handler<Context extends GameContext>(
  req: ExtendedRequest<Context>,
  res: Response,
) {
  const gameId = req.params['gameId'];
  if (!gameId) {
    res.status(404).json({ message: 'Invalid gameId' }).send();
    return;
  }
  let body: RequestBody;
  try {
    body = validateBody(req.body);
  } catch (err: unknown) {
    res.status(422).send({ message: (err as Error).message });
    return;
  }
  const lud16 = body.lud16.toLowerCase();
  const game = await findGame(req.context.prisma, gameId, lud16);
  if (!game) {
    res
      .status(404)
      .send({ message: `No running game found with id ${gameId}` });
    return;
  }
  if (!VALID_STATUSES.includes(game.status)) {
    res
      .status(409)
      .send({ message: 'This game is no longer accepting new players' });
    return;
  }
  if (game.players.some((p) => lud16.toLowerCase() === p.lud16.toLowerCase())) {
    res.status(409).send({ message: `${lud16} is already playing` });
    return;
  }
  if (!(await isServerActive(lud16))) {
    const message = `Server for ${lud16} does not handle lud16 correctly`;
    res.status(400).json({ message }).send();
    return;
  }
  const ticketId = await generateTicket(req.context.prisma, game.id, lud16);
  let lud06Res;
  try {
    lud06Res = await getInvoice(gameId, game.ticketPrice.toString(), ticketId);
  } catch (err: unknown) {
    const message = (err as Error).message;
    res.status(500).json({ message }).send();
    return;
  }
  res.status(200).json(lud06Res).send();
}

export default handler;
