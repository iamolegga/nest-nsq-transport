import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import { ClientProxy, Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { suite, test } from '@testdeck/jest';
import { Message } from 'nsqjs';

import { NSQContext, NSQPattern } from '../src';

import { Base } from './base-suite';

@suite
export class ContextSuite extends Base {
  patterns = [new NSQPattern('topic-ctx', 'channel-ctx')];

  private ctrl!: Type<{ emit(): Promise<void> }>;

  get metadata(): ModuleMetadata {
    const wg = this.wg;
    const token = this.clientToken;
    const data = Math.random().toString();

    @Controller()
    class TestController {
      constructor(@Inject(token) private readonly client: ClientProxy) {}

      @EventPattern('topic-ctx/channel-ctx')
      handle(@Payload() event: unknown, @Ctx() ctx: NSQContext) {
        expect(ctx.message).toBeInstanceOf(Message);
        expect(ctx.pattern).toMatchObject(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          NSQPattern.parse('topic-ctx/channel-ctx')!,
        );
        expect(event).toEqual(data);
        wg.done();
      }

      async emit() {
        wg.add(1);
        await this.client.emit('topic-ctx', data).toPromise();
      }
    }

    this.ctrl = TestController;

    return { ...super.metadata, controllers: [TestController] };
  }

  @test
  async 'context shoud have original message and pattern'() {
    await this.app.get(this.ctrl).emit();
    await this.wg.wait();
  }

  async after() {
    await this.app.close();
  }
}
