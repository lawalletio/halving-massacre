import {
  Module,
  DefaultContext,
  DirectOutbox,
  requiredEnvVar,
} from '@lawallet/module';
import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { PrismaClient } from '@prisma/client';

export type GameContext = {
  prisma: PrismaClient;
  writeNDK: NDK;
} & DefaultContext;

const writeNDK = new NDK({
  explicitRelayUrls: requiredEnvVar('NOSTR_WRITE_RELAYS')
    .split(',')
    .map((r) =>
      'wss://relay.lawallet.ar' === r ? requiredEnvVar('LAWALLET_RELAY') : r,
    ),
  signer: new NDKPrivateKeySigner(requiredEnvVar('NOSTR_PRIVATE_KEY')),
});

const readNDK = new NDK({
  explicitRelayUrls: requiredEnvVar('NOSTR_RELAYS')
    .split(',')
    .map((r) =>
      'wss://relay.lawallet.ar' === r ? requiredEnvVar('LAWALLET_RELAY') : r,
    ),
});

const context: GameContext = {
  outbox: new DirectOutbox(writeNDK),
  prisma: new PrismaClient(),
  writeNDK,
};

const module = Module.build<GameContext>({
  context,
  nostrPath: `${import.meta.dirname}/nostr`,
  port: Number(requiredEnvVar('PORT')),
  restPath: `${import.meta.dirname}/rest`,
  writeNDK,
  readNDK,
});

void module.start();
