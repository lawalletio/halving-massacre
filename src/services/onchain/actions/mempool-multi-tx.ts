import { OnchainContext } from '../service';

export interface MempoolTransactions {
  [address: string]: unknown; // tx
}

const handleAction = async (
  txs: MempoolTransactions,
  context: OnchainContext,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  console.info('-- Mempool-Multi --');
  const { ws: _ws } = context;

  Object.keys(txs).forEach((address) => {
    console.dir(txs[address]);
  });

  //   console.info('context: ');
  //   console.dir(context);
};

export default handleAction;
