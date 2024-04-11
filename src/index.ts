import {
  Module,
  DefaultContext,
  DirectOutbox,
  requiredEnvVar,
} from '@lawallet/module';
import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { PrismaClient } from '@prisma/client';
import { StatePublisher } from '@services/statePublisher';
import { startMempoolSpaceConnection } from '@src/mempoolspace';

export type GameContext = {
  prisma: PrismaClient;
  writeNDK: NDK;
  statePublisher: StatePublisher;
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

const prisma = new PrismaClient();
const outbox = new DirectOutbox(writeNDK);
const statePublisher = new StatePublisher(outbox, prisma);
const context: GameContext = { outbox, prisma, writeNDK, statePublisher };

const module = Module.build<GameContext>({
  context,
  nostrPath: `${import.meta.dirname}/nostr`,
  port: Number(requiredEnvVar('PORT')),
  restPath: `${import.meta.dirname}/rest`,
  writeNDK,
  readNDK,
});

startMempoolSpaceConnection(prisma);
void module.start();
