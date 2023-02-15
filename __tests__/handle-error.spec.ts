import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import { ClientProxy, EventPattern } from '@nestjs/microservices';
import { suite, test, timeout } from '@testdeck/jest';

import { NSQPattern, NSQStrategy } from '../src';

import { Base } from './base-suite';

@suite
export class HandleError extends Base {
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

  @test
  @timeout(10000)
  async 'should throw error and retry again same message'() {
    await this.app.get(this.ctrl).emit();
    await this.wg.wait();
  }
}
