import { Controller, ModuleMetadata } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { suite, test } from '@testdeck/jest';

import { NSQPattern } from '../src';

import { Base } from './base-suite';

@suite
export class MsgPatternHandler extends Base {
  patterns = [new NSQPattern('topic-msg', 'channel-msg')];
  awaitListeningInBeforeHook = false;

  get metadata(): ModuleMetadata {
    @Controller()
    class TestController {
      @MessagePattern('topic-msg/channel-msg')
      handle(_event: unknown) {}
    }

    return { ...super.metadata, controllers: [TestController] };
  }

  @test
  async 'should throw on start'() {
    await expect(this.listening.promise).rejects.toBeTruthy();
  }
}
