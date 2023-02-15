import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { suite, test } from '@testdeck/jest';

import { NSQPattern } from '../src';

import { Base } from './base-suite';

@suite
export class MsgPatternSender extends Base {
  patterns = [new NSQPattern('topic-msg', 'channel-msg')];
  private ctrl!: Type<{ emit(): Promise<void> }>;

  get metadata(): ModuleMetadata {
    const token = this.clientToken;
    const data = Math.random().toString();

    @Controller()
    class TestController {
      constructor(@Inject(token) private readonly client: ClientProxy) {}

      async emit() {
        await this.client.send('topic-msg', data).toPromise();
      }
    }

    this.ctrl = TestController;

    return { ...super.metadata, controllers: [TestController] };
  }

  @test
  async 'send should throw'() {
    await expect(this.app.get(this.ctrl).emit()).rejects.toBeTruthy();
  }
}
