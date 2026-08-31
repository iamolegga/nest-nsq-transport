import { Controller, ModuleMetadata } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { NSQPattern } from '../src';

import { Base, useSuite } from './base-suite';

class MsgPatternHandler extends Base {
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

  async expectListeningToReject() {
    await expect(this.listening.promise).rejects.toBeTruthy();
  }
}

describe('MsgPatternHandler', () => {
  const getSuite = useSuite(() => new MsgPatternHandler());

  it('should throw on start', async () => {
    await getSuite().expectListeningToReject();
  });
});
