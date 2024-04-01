import { ExtendedRequest } from '@lawallet/module';
import { getInvoice, validLud16 } from '../../../../utils';
import type { Response } from 'express';
import { GameContext } from '../../../../index';
import { Prisma, PrismaClient, Status } from '@prisma/client';

const VALID_STATUSES: Status[] = [Status.SETUP, Status.INITIAL, Status.NORMAL];

const GAME_SELECT = Prisma.validator<Prisma.GameSelect>()({
  minBet: true,
  nextMassacre: true,
  status: true,
  currentRound: {
    select: {
      roundPlayers: { select: { player: { select: { lud16: true } } } },
    },
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
      currentRound: {
        select: {
          ...GAME_SELECT.currentRound.select,
          roundPlayers: {
            ...GAME_SELECT.currentRound.select.roundPlayers,
            where: { player: { lud16 } },
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
    res.status(422).send({ message: 'Required query params amount and lud16' });
    return;
  }
  let amount: bigint;
  let lud16: string;
  try {
    amount = BigInt(qAmount);
    lud16 = validLud16(req.query['lud16']);
  } catch (err: unknown) {
    res.status(422).send({ message: (err as Error).message });
    return;
  }
  const game = await findGame(req.context.prisma, gameId, lud16);
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
  if (!game.currentRound.roundPlayers.some((rp) => lud16 === rp.player.lud16)) {
    res.status(409).send({ message: `${lud16} is not playing this round` });
    return;
  }
  if (amount < game.minBet) {
    res.status(400).send({ message: `Not enouth power, min: ${game.minBet}` });
    return;
  }
  let lud06Res;
  try {
    lud06Res = await getInvoice(gameId, amount.toString(), lud16);
  } catch (err: unknown) {
    const message = (err as Error).message;
    res.status(500).json({ message }).send();
    return;
  }
  res.status(200).json(lud06Res).send();
}

export default handler;
