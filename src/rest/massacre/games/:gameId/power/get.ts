import { ExtendedRequest, logger } from '@lawallet/module';
import { ZapType, getInvoice, validWalias } from '@src/utils';
import type { Response } from 'express';
import { GameContext } from '@src/index';
import { Prisma, PrismaClient, Status } from '@prisma/client';
import { randomBytes } from 'crypto';
import { Debugger } from 'debug';

const log: Debugger = logger.extend('rest:game:gameId:power:get');
const warn: Debugger = log.extend('warn');

const VALID_STATUSES: Status[] = [Status.SETUP, Status.INITIAL, Status.NORMAL];

const GAME_SELECT = Prisma.validator<Prisma.GameSelect>()({
  minBet: true,
  nextMassacre: true,
  status: true,
  currentRound: {
    select: {
      roundPlayers: { select: { player: { select: { walias: true } } } },
    },
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
      currentRound: {
        select: {
          ...GAME_SELECT.currentRound.select,
          roundPlayers: {
            ...GAME_SELECT.currentRound.select.roundPlayers,
            where: { player: { walias } },
          },
        },
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
    res.status(404).json({ success: false, message: 'Invalid gameId' }).send();
    return;
  }
  const qAmount = req.query['amount'];
  if (!qAmount || 'string' !== typeof qAmount) {
    res.status(422).send({
      success: false,
      message: 'Required query params amount and walias',
    });
    return;
  }
  const amount = Number(qAmount);
  if (!Number.isSafeInteger(amount) || amount <= 0 ) {
    const message = `Amount must be a positive integer, received: ${amount}`;
    res.status(422).send({ success: false, message });
    return;
  }
  let walias: string;
  try {
    walias = validWalias(req.query['walias']);
  } catch (err: unknown) {
    res.status(422).send({ success: false, message: (err as Error).message });
    return;
  }
  const game = await findGame(req.context.prisma, gameId, walias);
  if (!game) {
    res.status(404).send({
      success: false,
      message: `No running game found with id ${gameId}`,
    });
    return;
  }
  if (!VALID_STATUSES.includes(game.status)) {
    res.status(409).send({
      success: false,
      message: `This game is not accepting power wait for block: ${game.nextMassacre}`,
    });
    return;
  }
  if (
    !game.currentRound.roundPlayers.some((rp) => walias === rp.player.walias)
  ) {
    res
      .status(409)
      .send({ success: false, message: `${walias} is not playing this round` });
    return;
  }
  if (amount < game.minBet) {
    res.status(400).send({
      success: false,
      message: `Not enough power, min: ${game.minBet}`,
    });
    return;
  }
  const eTag = randomBytes(32).toString('hex');
  const content = {
    type: ZapType.POWER,
    gameId,
    walias,
  };
  let lud06Res;
  try {
    lud06Res = await getInvoice(eTag, amount, JSON.stringify(content));
  } catch (err: unknown) {
    warn('Error getting invoice: %O', err);
    const message = (err as Error).message;
    res.status(500).json({ success: false, message }).send();
    return;
  }
  res
    .status(200)
    .json({ success: true, eTag, ...lud06Res })
    .send();
}

export default handler;
