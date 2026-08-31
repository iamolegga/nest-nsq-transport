import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import {
  ClientProxy,
  ClientsModule,
  EventPattern,
} from '@nestjs/microservices';

import { NSQClient, NSQClientOpitons, NSQPattern } from '../src';

import { Base, useSuite } from './base-suite';

class Multi extends Base {
  patterns = [
    new NSQPattern('topic-multi', 'channel-multi-1'),
    new NSQPattern('topic-multi', 'channel-multi-2'),
  ];

  private ctrl!: Type<{ emit(): Promise<void> }>;

  get metadata(): ModuleMetadata {
    const wg = this.wg;
    const token = this.clientToken;
    const data = Math.random().toString();

    @Controller()
    class TestController {
      constructor(@Inject(token) private readonly client: ClientProxy) {}

      @EventPattern('topic-multi/channel-multi-1')
      handle1(event: unknown) {
        expect(event).toBe(data);
        wg.done();
      }

      @EventPattern('topic-multi/channel-multi-2')
      handle2(event: unknown) {
        expect(event).toBe(data);
        wg.done();
      }

      async emit() {
        wg.add(2);
        await this.client.emit('topic-multi', data).toPromise();
      }
    }

    this.ctrl = TestController;

    const [hostname, port] = Base.nsqdTCP.split(':');
    if (!hostname || !port) throw new Error('Invalid NSQD TCP URL');

    return {
      imports: [
        ClientsModule.register([
          {
            name: this.clientToken,
            customClass: NSQClient,
            options: <NSQClientOpitons>{
              nsqdHost: hostname,
              nsqdPort: Number(port),
            },
          },
        ]),
      ],
      controllers: [TestController],
    };
  }

  async emitAndWait() {
    await this.app.get(this.ctrl).emit();
    await this.wg.wait();
  }
}

describe('Multi', () => {
  const getSuite = useSuite(() => new Multi());

  it('should send and receive same data in two channels', async () => {
    await getSuite().emitAndWait();
  });
});
