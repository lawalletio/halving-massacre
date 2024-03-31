import {
  Module,
  DefaultContext,
  getWriteNDK,
  DirectOutbox,
  requiredEnvVar,
} from '@lawallet/module';
import { PrismaClient } from '@prisma/client';

export type GameContext = DefaultContext & { prisma: PrismaClient };

const context: GameContext = {
  outbox: new DirectOutbox(getWriteNDK()),
  prisma: new PrismaClient(),
};

const module = Module.build<GameContext>({
  context,
  nostrPath: `${import.meta.dirname}/nostr`,
  port: Number(requiredEnvVar('PORT')),
  restPath: `${import.meta.dirname}/rest`,
});

void module.start();
