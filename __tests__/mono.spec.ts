import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import { ClientProxy, EventPattern } from '@nestjs/microservices';
import { suite, test } from '@testdeck/jest';

import { NSQPattern } from '../src';

import { Base } from './base-suite';

@suite
export class Mono extends Base {
  patterns = [new NSQPattern('topic-mono', 'channel-mono')];

  private ctrl!: Type<{ emit(): Promise<void> }>;

  get metadata(): ModuleMetadata {
    const wg = this.wg;
    const token = this.clientToken;
    const data = Math.random().toString();

    @Controller()
    class TestController {
      constructor(@Inject(token) private readonly client: ClientProxy) {}

      @EventPattern('topic-mono/channel-mono')
      handle(event: unknown) {
        expect(event).toBe(data);
        wg.done();
      }

      async emit() {
        wg.add(2);
        // test double emit to cover client's connect method logic
        // as nest will call it on each emit
        await this.client.emit('topic-mono', data).toPromise();
        await this.client.emit('topic-mono', data).toPromise();
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
