import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import { ClientProxy, EventPattern } from '@nestjs/microservices';
import { suite, test } from '@testdeck/jest';

import { NSQPattern } from '../src';

import { Base } from './base-suite';

@suite
export class Wrong extends Base {
  patterns = [new NSQPattern('topic-wrong', 'channel-wrong')];

  private ctrl!: Type<{ emit(): Promise<void> }>;

  get metadata(): ModuleMetadata {
    const wg = this.wg;
    const token = this.clientToken;
    const data = Math.random().toString();

    @Controller()
    class TestController {
      constructor(@Inject(token) private readonly client: ClientProxy) {}

      @EventPattern('ignore-wrong-pattern')
      ignoredString(_event: unknown) {}

      @EventPattern({ topic: 'ignore-wrong-pattern' })
      ignoredObject(_event: unknown) {}

      @EventPattern('topic-wrong/channel-wrong')
      handle(event: unknown) {
        expect(event).toBe(data);
        wg.done();
      }

      async emit() {
        wg.add(1);
        await this.client.emit('topic-wrong', data).toPromise();
      }
    }

    this.ctrl = TestController;

    return { ...super.metadata, controllers: [TestController] };
  }

  @test
  async 'should send and receive same data'() {
    await this.app.get(this.ctrl).emit();
    await this.wg.wait();
  }
}
