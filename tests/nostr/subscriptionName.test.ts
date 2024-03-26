import { DefaultContext } from '@lawallet/module';
import { getHandler } from '@nostr/subscriptionName';
import { NostrEvent } from 'node_modules/@nostr-dev-kit/ndk/dist';

describe('Nostr handler', () => {
  it('should handle received evenshould handle received event', async () => {
    const context: DefaultContext = {
      outbox: { publish: jest.fn() },
    } as unknown as DefaultContext;
    const event = {} as NostrEvent;

    const handler = getHandler(context);
    await handler(event);

    expect(context.outbox.publish).toHaveBeenCalledWith(event);
  });
});
