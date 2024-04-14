import { OnchainContext } from '../service';

export interface MempoolTransaction {
  txid: string;
}

const handleAction = async (
  txs: MempoolTransaction[],
  context: OnchainContext,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  const { ws } = context;

  console.info('-- Mempool --');

  txs.forEach((tx) => {
    console.info('tx: ');
    console.dir(tx);

    console.info(`Tracking txid ${tx.txid}...`);
    ws.send(JSON.stringify({ 'track-tx': tx.txid }));
  });

  //   console.info('context: ');
  //   console.dir(context);
};

export default handleAction;
