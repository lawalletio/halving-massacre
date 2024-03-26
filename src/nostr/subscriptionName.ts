import { DefaultContext, EventHandler } from '@lawallet/module';
import { NDKFilter, NostrEvent } from 'node_modules/@nostr-dev-kit/ndk/dist';

const filter: NDKFilter = {
  // ids: null,
  authors: ['f8b62586d5ad419ed67cb107f927b03cdfea5f5b13155a7a64ffb959774a8e17'],
  kinds: [1],
  // '#e': null,
  // '#p': null,
  // '#a': null,
  since: Math.floor(Date.now() / 1000) - 86000,
  until: Math.floor(Date.now() / 1000) + 86000,
  // limit: null,
};

function getHandler<Context extends DefaultContext = DefaultContext>(
  ctx: Context,
): EventHandler {
  return async (event: NostrEvent): Promise<void> => {
    await ctx.outbox.publish(event);
  };
}

export { filter, getHandler };
