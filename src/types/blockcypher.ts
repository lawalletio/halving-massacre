export interface BlockCypherNotification {
  block_height: number; // -1,
  block_index: number; // -1,
  hash: string; // '9beee7b8d7537e6017dce4f95d6d4a40dc43c656dbd43966971a3c106b4ec526',
  addresses: string[];
  // [
  //     '2N2aqH8BYJArYJSD8i5Jjev6iLcsCXTKNSu',
  //     'tb1qrkzx0xvscp8r8trqnyyf8vc9tznaw4hjny5j2f'
  // ],
  total: number; // 87756,
  fees: number; // 165,
  size: number; // 247,
  vsize: number; // 165,
  preference: 'low';
  relayed_by: string; // '84.250.74.230:18333',
  received: string; // '2024-04-13T19:58:57.054Z',
  ver: number; // 2,
  double_spend: false;
  vin_sz: number; // 1,
  vout_sz: number; // 2,
  opt_in_rbf: true;
  confirmations: number; // 0,
  inputs: BlockCypherNotificationInput[];
  outputs: BlockCypherNotificationOutput[];
}

interface BlockCypherNotificationOutput {
  value: number; // 1000,
  script: string; // '00141d84679990c04e33ac60990893b30558a7d756f2',
  addresses: string[]; // [ 'tb1qrkzx0xvscp8r8trqnyyf8vc9tznaw4hjny5j2f' ],
  script_type: string; // 'pay-to-witness-pubkey-hash'
}

interface BlockCypherNotificationInput {
  prev_hash: string; // '0678252e6bffe54a3e37d80a1e12fa3d121bb3a9f1f391fe4d7f6264413b242d',
  output_index: number; // 0,
  script: string; // '16001466c395144e9658bd6f261ff81d603b269f9435e4',
  output_value: number; // 87921,
  sequence: number; // 4294967293,
  addresses: string[]; // [ '2N2aqH8BYJArYJSD8i5Jjev6iLcsCXTKNSu' ],
  script_type: string; // 'pay-to-script-hash',
  age: number; // 2586037
}

export interface BlockCypherDeriveAddressResponse {
  chains: [
    {
      chain_addresses: [
        {
          address: string; // 'tb1qvenk65v6x0v4ch7049qqff0hmw0fsxth3lx79n';
          public: string; // '03e2b568279ad056c980fa1e9f116b621773d3513f6c21b5634b63f62686c8a847';
          path: string; // 'm/5';
        },
      ];
    },
  ];
}
