export interface CryptoapisTxItem {
  blockchain: string; // 'bitcoin';
  network: 'testnet' | 'mainnet';
  address: string; // '2N2aqH8BYJArYJSD8i5Jjev6iLcsCXTKNSu';
  transactionId: string; // '8073f17d3a6d90c36252aa67f0447d7881daedc957f3e0cc8e2ddfe7cba97df3';
  amount: string; // '0.00013555';
  unit: 'BTC' | 'satoshi';
  direction: 'incoming' | 'outgoing';
}

export interface CryptoapisConfirmedTxItem extends CryptoapisTxItem {
  minedInBlock: {
    height: number; // 2586034;
    hash: string; // '00000000000000114a81c4af36313851c3c9555c3d10457a0d09ba45dc63ec55';
    timestamp: number; // 1712892823;
  }[];
  currentConfirmations: number; // 1;
  targetConfirmations: number; // 1;
}

export interface CryptoapisMempoolTxItem extends CryptoapisTxItem {
  firstSeenInMempoolTimestamp: number; // 1712886781,
}

export interface CryptoapisNotificaction {
  apiVersion: string; // '2021-03-20';
  referenceId: string; // 'ad9b20f4-1a4b-48b6-9d40-b58b712c86f6';
  idempotencyKey: string; // '36f2dd2c8f3b9d5836431fd1da2c2fdb7b51fd45b453a7b3143e0b718d91b616';
  data: {
    product: 'BLOCKCHAIN_EVENTS';
    event:
      | 'ADDRESS_COINS_TRANSACTION_UNCONFIRMED'
      | 'ADDRESS_COINS_TRANSACTION_CONFIRMED_EACH_CONFIRMATION';
    item: CryptoapisTxItem;
  };
}

export interface CryptoapisMempoolTx extends CryptoapisNotificaction {
  data: {
    product: 'BLOCKCHAIN_EVENTS';
    event: 'ADDRESS_COINS_TRANSACTION_UNCONFIRMED';
    item: CryptoapisMempoolTxItem;
  };
}

export interface CryptoapisConfirmedTx extends CryptoapisNotificaction {
  data: {
    product: 'BLOCKCHAIN_EVENTS';
    event: 'ADDRESS_COINS_TRANSACTION_CONFIRMED_EACH_CONFIRMATION';
    item: CryptoapisConfirmedTxItem;
  };
}
