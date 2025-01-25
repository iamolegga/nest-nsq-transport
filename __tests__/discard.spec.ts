import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import { ClientProxy, Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { suite, test } from '@testdeck/jest';

import { NSQContext, NSQPattern, NSQStrategy } from '../src';

import { Base } from './base-suite';

@suite
export class Discard extends Base {
  patterns = [
    new NSQPattern('topic-discard-1', 'channel-discard-1'),
    new NSQPattern('topic-discard-2', 'channel-discard-2'),
  ];
  strategy = new NSQStrategy({
    defaultChannelOptions: {
      maxAttempts: 1,
      nsqdTCPAddresses: [Base.nsqdTCP],
      requeueParams: () => [0, false],
    },
  });

  private ctrl!: Type<{ emit1(): Promise<void>; emit2(): Promise<void> }>;

  get metadata(): ModuleMetadata {
    const wg = this.wg;
    const token = this.clientToken;
    const data = Math.random().toString();

    @Controller()
    class TestController {
      constructor(@Inject(token) private readonly client: ClientProxy) {}

      @EventPattern('topic-discard-1/channel-discard-1')
      handle1(event: unknown) {
        expect(event).toBe(data);
        wg.done();
        throw new Error('requeue');
      }

      @EventPattern('topic-discard-1/channel-discard-1/discard')
      handleDiscarded1(event: unknown) {
        expect(event).toBe(data);
        wg.done();
      }

      @EventPattern('topic-discard-2/channel-discard-2')
      handle2(@Payload() event: unknown, @Ctx() ctx: NSQContext) {
        expect(event).toBe(data);
        wg.done();
        if (ctx.message.attempts === 1) throw new Error('requeue');
      }

      async emit1() {
        wg.add(2);
        await this.client.emit('topic-discard-1', data).toPromise();
      }

      async emit2() {
        wg.add(2);
        await this.client.emit('topic-discard-2', data).toPromise();
      }
    }

    this.ctrl = TestController;

    return { ...super.metadata, controllers: [TestController] };
  }

  @test
  async 'message goes to discard handler'() {
    await this.app.get(this.ctrl).emit1();
    await this.wg.wait();
  }

  @test
  async 'message goes to same handler when no discard handler'() {
    await this.app.get(this.ctrl).emit2();
    await this.wg.wait();
  }
}
