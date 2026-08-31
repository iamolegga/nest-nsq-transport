import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import { ClientProxy, Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { Message } from 'nsqjs';

import { NSQContext, NSQPattern } from '../src';

import { Base, useSuite } from './base-suite';

class ContextSuite extends Base {
  patterns = [new NSQPattern('topic-ctx', 'channel-ctx')];

  private ctrl!: Type<{ emit(): Promise<void> }>;

  get metadata(): ModuleMetadata {
    const wg = this.wg;
    const token = this.clientToken;
    const data = Math.random().toString();

    @Controller()
    class TestController {
      constructor(@Inject(token) private readonly client: ClientProxy) {}

      // the explicit `<string>` picks NestJS 12's plain `MethodDecorator`
      // overload; the typed-events one it would otherwise resolve to declares
      // every parameter after the payload as `unknown`, so a `@Ctx()` one
      // cannot be typed
      @EventPattern<string>('topic-ctx/channel-ctx')
      handle(@Payload() event: unknown, @Ctx() ctx: NSQContext) {
        expect(ctx.message).toBeInstanceOf(Message);
        expect(ctx.pattern).toMatchObject(
          // biome-ignore lint/style/noNonNullAssertion: the literal is a well-formed pattern, so `parse` cannot return null for it
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

  async emitAndWait() {
    await this.app.get(this.ctrl).emit();
    await this.wg.wait();
  }

  async after() {
    await this.app.close();
  }
}

describe('ContextSuite', () => {
  const getSuite = useSuite(() => new ContextSuite());

  it('context shoud have original message and pattern', async () => {
    await getSuite().emitAndWait();
  });
});
