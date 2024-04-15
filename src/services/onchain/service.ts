import { requiredEnvVar } from '@lawallet/module';
import type { PrismaClient } from '@prisma/client';
import { BlockCypherDeriveAddressResponse } from '@src/types/blockcypher';

export interface OnchainContext {
  prisma: PrismaClient;
}

export type AddressToPlayerIndex = { [address: string]: string };

export class OnchainService {
  private context: OnchainContext;
  private addressesCache: AddressToPlayerIndex = {}; // playerId

  constructor(context: OnchainContext) {
    this.context = context;
  }

  public async init(): Promise<void> {
    await this.populateAddressesCache();
  }

  public async populateAddressesCache(): Promise<void> {
    // Fetch players where onchainAddress is not null and include both playerId and onchainAddress in the results
    const players = await this.context.prisma.player.findMany({
      where: {
        onchainAddress: {
          not: null, // Condition to ensure we only fetch records with a non-null onchainAddress
        },
      },
      select: {
        id: true, // We want to fetch the playerId
        onchainAddress: true, // And the onchainAddress
      },
    });

    console.info('Current players');
    console.dir(players);

    // Reduce the array of player objects to a single object mapping onchainAddress to playerId
    const addressToIdMap = players.reduce<AddressToPlayerIndex>(
      (acc, player) => {
        if (player.onchainAddress) {
          acc[player.onchainAddress] = player.id;
        }
        return acc;
      },
      {},
    );

    this.addressesCache = addressToIdMap;
  }

  public getAddresses(): AddressToPlayerIndex {
    return this.addressesCache;
  }

  public async getNewAddress(): Promise<string> {
    const network = 'test3';
    const walletName = 'testito';
    const apiKey = requiredEnvVar('BLOCKCYPHER_API_KEY');
    const url = `https://api.blockcypher.com/v1/btc/${network}/wallets/hd/${walletName}/addresses/derive?token=${apiKey}`;

    console.info(`url : ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.info('Not ok!');
      throw new Error('Failed to derive address');
    }
    const response = (await res.json()) as BlockCypherDeriveAddressResponse;

    return response.chains[0].chain_addresses[0].address;
  }

  public async generatePlayerAddress(playerId: string): Promise<string> {
    console.info('generatePlayerAddress');

    const address = 'tb1q29j9uzskfmw4l4lclhccypwh55khypkdqdhlla';
    // const address = await this.getNewAddress();

    console.info(`address : ${address}`);

    await this.updatePlayerOnchainAddress(playerId, address);

    this.addressesCache[address] = playerId;

    console.dir(this.addressesCache[address]);
    return address;
  }

  public async updatePlayerOnchainAddress(
    walias: string,
    address: string,
  ): Promise<void> {
    const result = await this.context.prisma.player.updateMany({
      data: {
        onchainAddress: address, // Set the new onchain address
      },
      where: { walias, onchainAddress: null },
    });

    if (result.count > 0) {
      console.log(
        `No player updated. Either player ID ${walias} does not exist, or the onchain address is already set.`,
      );
    } else {
      console.log(
        `Player ${walias} updated with new onchain address: ${address}`,
      );
    }
  }
}
