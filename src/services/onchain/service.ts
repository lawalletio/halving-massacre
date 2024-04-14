import { PrismaClient } from '@prisma/client';
import { type WebSocket } from 'ws';
import BIP84 from 'bip84';
import { requiredEnvVar } from '@lawallet/module';

export interface OnchainContext {
  prisma: PrismaClient;
  ws: WebSocket;
}

export class OnchainService {
  // private context: OnchainContext;

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor() {
    // this.context = context;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async getPendingTransactions(): Promise<string[]> {
    return [
      'b4f4dcef2ad58dfa2502e159948677e48b6208cc5061d7175568fb1ef3ba7d95',
      '4f97c7d6920c131bfe7953986d6e8f1d9d2a9468d796bfa40d4a4a9f9dd01ee9',
      'b101d04f4a0101b542c811679d874c2be9f15b52c432c90d925b276c2e2f471f',
    ];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async getAddresses(): Promise<string[]> {
    const list: string[] = [];
    let address;
    for (let i = 0; i < 200; i++) {
      address = await this.generateAddress(i);
      list.push(address);
      console.log(`${i}: ${address}`);
    }
    return list;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async generateAddress(index: number = 0): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const account = new BIP84.fromZPub(requiredEnvVar('ONCHAIN_ZPUB_KEY'));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return account.getAddress(index) as string;
    // return 'tb1qrkzx0xvscp8r8trqnyyf8vc9tznaw4hjny5j2f';
  }
}
