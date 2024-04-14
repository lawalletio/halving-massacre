import {
  Module,
  DefaultContext,
  DirectOutbox,
  requiredEnvVar,
  logger,
} from '@lawallet/module';
import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { PrismaClient } from '@prisma/client';
import { OnchainService } from '@services/onchain/service';
import { StatePublisher } from '@services/statePublisher';
import { startMempoolSpaceConnection } from '@src/mempoolspace';
import { Debugger } from 'debug';

export type GameContext = {
  prisma: PrismaClient;
  writeNDK: NDK;
  statePublisher: StatePublisher;
} & DefaultContext;

const log: Debugger = logger.extend('main');

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
const onchainService = new OnchainService();
const context: GameContext = { outbox, prisma, writeNDK, statePublisher };

const module = Module.build<GameContext>({
  context,
  nostrPath: `${import.meta.dirname}/nostr`,
  port: Number(requiredEnvVar('PORT')),
  restPath: `${import.meta.dirname}/rest`,
  writeNDK,
  readNDK,
});

void (async () => {
  log('Getting addresses');
  const addresses = await onchainService.getAddresses();
  log('Getting pending transactions');
  const txs = await onchainService.getPendingTransactions();
  log('Start mempoolspace connection');
  console.info('Getting addresses');
  startMempoolSpaceConnection(addresses, txs, prisma);
  log('Start module');
  console.info('Start module');
  void module.start();
})();
