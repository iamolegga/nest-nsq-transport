import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import { ClientProxy, EventPattern } from '@nestjs/microservices';

import { NSQPattern, NSQStrategy } from '../src';

import { Base, useSuite } from './base-suite';

class HandleError extends Base {
  patterns = [new NSQPattern('topic-handle-error', 'channel-handle-error')];
  strategy = new NSQStrategy({
    defaultChannelOptions: {
      nsqdTCPAddresses: [Base.nsqdTCP],
      requeueParams: [0, false],
    },
  });

  private ctrl!: Type<{ emit(): Promise<void> }>;

  get metadata(): ModuleMetadata {
    const wg = this.wg;
    const token = this.clientToken;
    const data = Math.random().toString();

    @Controller()
    class TestController {
      private attempt = 0;
      constructor(@Inject(token) private readonly client: ClientProxy) {}

      @EventPattern('topic-handle-error/channel-handle-error')
      handle(event: unknown) {
        if (this.attempt === 0) {
          this.attempt++;
          throw new Error('retry');
        }
        expect(event).toBe(data);
        wg.done();
      }

      async emit() {
        wg.add(1);
        await this.client.emit('topic-handle-error', data).toPromise();
      }
    }

    this.ctrl = TestController;

    return { ...super.metadata, controllers: [TestController] };
  }

  async emitAndWait() {
    await this.app.get(this.ctrl).emit();
    await this.wg.wait();
  }
}

describe('HandleError', () => {
  const getSuite = useSuite(() => new HandleError());

  it('should throw error and retry again same message', {
    timeout: 10000,
  }, async () => {
    await getSuite().emitAndWait();
  });
});
