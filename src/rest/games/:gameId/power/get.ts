import { ExtendedRequest } from '@lawallet/module';
import { ZapType, getInvoice, validWalias } from '../../../../utils';
import type { Response } from 'express';
import { GameContext } from '../../../../index';
import { Prisma, PrismaClient, Status } from '@prisma/client';
import { randomBytes } from 'crypto';

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
    res.status(404).json({ message: 'Invalid gameId' }).send();
    return;
  }
  const qAmount = req.query['amount'];
  if (!qAmount || 'string' !== typeof qAmount) {
    res
      .status(422)
      .send({ message: 'Required query params amount and walias' });
    return;
  }
  let amount: number;
  let walias: string;
  try {
    amount = Number(qAmount);
    walias = validWalias(req.query['walias']);
  } catch (err: unknown) {
    res.status(422).send({ message: (err as Error).message });
    return;
  }
  const game = await findGame(req.context.prisma, gameId, walias);
  if (!game) {
    res
      .status(404)
      .send({ message: `No running game found with id ${gameId}` });
    return;
  }
  if (!VALID_STATUSES.includes(game.status)) {
    res.status(409).send({
      message: `This game is not accepting power wait for block: ${game.nextMassacre}`,
    });
    return;
  }
  if (
    !game.currentRound.roundPlayers.some((rp) => walias === rp.player.walias)
  ) {
    res.status(409).send({ message: `${walias} is not playing this round` });
    return;
  }
  if (amount < game.minBet) {
    res.status(400).send({ message: `Not enough power, min: ${game.minBet}` });
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
    lud06Res = await getInvoice(
      eTag,
      amount.toString(),
      JSON.stringify(content),
    );
  } catch (err: unknown) {
    const message = (err as Error).message;
    res.status(500).json({ message }).send();
    return;
  }
  res
    .status(200)
    .json({ eTag, ...lud06Res })
    .send();
}

export default handler;
