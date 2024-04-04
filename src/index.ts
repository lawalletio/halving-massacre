import {
  Module,
  DefaultContext,
  getWriteNDK,
  DirectOutbox,
  requiredEnvVar,
} from '@lawallet/module';
import NDK from '@nostr-dev-kit/ndk';
import { PrismaClient } from '@prisma/client';

export type GameContext = {
  prisma: PrismaClient;
  writeNDK: NDK;
} & DefaultContext;

const writeNDK = getWriteNDK();

const context: GameContext = {
  outbox: new DirectOutbox(getWriteNDK()),
  prisma: new PrismaClient(),
  writeNDK,
};

const module = Module.build<GameContext>({
  context,
  nostrPath: `${import.meta.dirname}/nostr`,
  port: Number(requiredEnvVar('PORT')),
  restPath: `${import.meta.dirname}/rest`,
  writeNDK,
});

void module.start();
