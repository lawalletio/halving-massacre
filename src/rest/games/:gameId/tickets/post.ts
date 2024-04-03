import { ExtendedRequest, logger } from '@lawallet/module';
import { type GameContext } from '../../../../index';
import { Debugger } from 'debug';
import type { Response } from 'express';
import { Prisma, PrismaClient, Status } from '@prisma/client';
import { WALIAS_RE, ZapType, getInvoice, validWalias } from '../../../../utils';
import { createHash } from 'crypto';

const log: Debugger = logger.extend('rest:game:gameId:ticket:post');
const trace: Debugger = log.extend('trace');
const debug: Debugger = log.extend('debug');
const warn: Debugger = log.extend('warn');

const VALID_STATUSES: Status[] = [Status.SETUP, Status.INITIAL];

type RequestBody = {
  walias: string;
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
  if (!('walias' in data)) {
    debug('Missing walias');
    throw new Error('Missing property walias');
  }
  try {
    return { walias: validWalias(data.walias) };
  } catch (err: unknown) {
    debug((err as Error).message);
    throw err;
  }
}

/**
 * Checks if the domain returns a valid lud06 response for the user
 *
 * @param address that we assume was previously validated as a valid address
 * @returns true if the domain returned a valid walias response false otherwise
 */
async function isServerActive(address: string): Promise<boolean> {
  const { username, domain } = address.match(WALIAS_RE)!.groups as {
    username: string;
    domain: string;
  };
  let res;
  try {
    res = await fetch(`https://${domain}/.well-known/lnurlp/${username}`);
  } catch (err: unknown) {
    warn('Error fetching %s: %O', address, err);
    return false;
  }
  if (res.status < 200 || 300 <= res.status) {
    log('walias request returned non success status %O', res.status);
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
 * Generates a ticket for a walias in a given game
 *
 * Only creates a new ticket if there is no ticket for that walias previously
 *
 * @param prisma client
 * @param gameId where the ticket will be created
 * @param walias for whom the ticket is
 * @return the id of the ticket
 */
async function generateTicket(
  prisma: PrismaClient,
  gameId: string,
  walias: string,
): Promise<string> {
  const ticket = await prisma.ticket.upsert({
    select: { id: true },
    create: { walias, game: { connect: { id: gameId } } },
    update: {},
    where: { gameId_walias: { gameId, walias } },
  });
  return ticket.id;
}

const GAME_SELECT = Prisma.validator<Prisma.GameSelect>()({
  id: true,
  ticketPrice: true,
  status: true,
  players: {
    select: { walias: true },
  },
});
type GameInfo = Prisma.GameGetPayload<{
  select: typeof GAME_SELECT;
}>;

/**
 * Finds a game by id, also returns if the walias is already a player
 *
 * @param prisma client
 * @param id of the game to search for
 * @param walias of the player we want to check
 * @return the game info if preset or null
 */
async function findGame(
  prisma: PrismaClient,
  id: string,
  walias: string,
): Promise<GameInfo | null> {
  return await prisma.game.findUnique({
    select: {
      ...GAME_SELECT,
      players: {
        ...GAME_SELECT.players,
        where: { walias },
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
    res.status(404).json({ sucess: false, message: 'Invalid gameId' }).send();
    return;
  }
  let body: RequestBody;
  try {
    body = validateBody(req.body);
  } catch (err: unknown) {
    res.status(422).send({ sucess: false, message: (err as Error).message });
    return;
  }
  const walias = body.walias.toLowerCase();
  const game = await findGame(req.context.prisma, gameId, walias);
  if (!game) {
    res.status(404).send({
      sucess: false,
      message: `No running game found with id ${gameId}`,
    });
    return;
  }
  if (!VALID_STATUSES.includes(game.status)) {
    res.status(409).send({
      sucess: false,
      message: 'This game is no longer accepting new players',
    });
    return;
  }
  if (
    game.players.some((p) => walias.toLowerCase() === p.walias.toLowerCase())
  ) {
    res
      .status(409)
      .send({ sucess: false, message: `${walias} is already playing` });
    return;
  }
  if (!(await isServerActive(walias))) {
    const message = `Server for ${walias} does not handle lud16 correctly`;
    res.status(400).json({ sucess: false, message }).send();
    return;
  }
  const ticketId = await generateTicket(req.context.prisma, game.id, walias);
  const eTag = createHash('sha256').update(ticketId).digest('hex');
  const content = {
    type: ZapType.TICKET,
    gameId,
    ticketId,
  };
  let lud06Res;
  try {
    lud06Res = await getInvoice(
      eTag,
      game.ticketPrice,
      JSON.stringify(content),
    );
  } catch (err: unknown) {
    const message = (err as Error).message;
    res.status(500).json({ sucess: false, message }).send();
    return;
  }
  res
    .status(200)
    .json({ sucess: true, eTag, ...lud06Res })
    .send();
}

export default handler;
