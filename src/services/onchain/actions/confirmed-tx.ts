import { OnchainContext } from '../service';

export interface TransactionPosition {
  txid: string;
  position: { block: number; vsize: number };
}

const handleConfirmedTx = async (
  tx: TransactionPosition,
  _context: OnchainContext,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  console.info('-- Confirmed --');

  //   const { ws } = context;

  if (tx.position.block === 0) {
    console.info('Block 0...');
    return;
  }
  console.info(`Confirmed tx (${tx.txid}) in block ${tx.position.block}!`);

  //   console.info('context: ');
  //   console.dir(context);
};

export default handleConfirmedTx;
