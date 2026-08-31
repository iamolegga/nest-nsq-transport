import { Controller, Inject, ModuleMetadata, Type } from '@nestjs/common';
import {
  ClientProxy,
  ClientsModule,
  EventPattern,
} from '@nestjs/microservices';

import {
  JSONDeserializer,
  JSONSerializer,
  NSQClient,
  NSQClientOpitons,
  NSQPattern,
  NSQStrategy,
} from '../src';

import { Base, useSuite } from './base-suite';

class Options extends Base {
  strategy = new NSQStrategy({
    defaultChannelOptions: { nsqdTCPAddresses: [Base.nsqdTCP] },
    channels: {
      'topic-opts': {
        'channel-opts': {
          name: 'test',
          requeueParams: [1, false],
        },
      },
    },
    deserializer: new JSONDeserializer(),
  });

  patterns = [new NSQPattern('topic-opts', 'channel-opts')];

  private ctrl!: Type<{ emit(): Promise<void> }>;

  get metadata(): ModuleMetadata {
    const wg = this.wg;
    const token = this.clientToken;
    const data = Math.random().toString();

    @Controller()
    class TestController {
      constructor(@Inject(token) private readonly client: ClientProxy) {}

      @EventPattern('topic-opts/channel-opts')
      handle(event: unknown) {
        expect(event).toBe(data);
        wg.done();
      }

      async emit() {
        wg.add(1);
        await this.client.emit('topic-opts', data).toPromise();
      }
    }

    this.ctrl = TestController;

    return {
      imports: [
        ClientsModule.register([
          {
            name: this.clientToken,
            customClass: NSQClient,
            options: <NSQClientOpitons>{
              nsqdURL: Base.nsqdTCP,
              serializer: new JSONSerializer(),
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

describe('Options', () => {
  const getSuite = useSuite(() => new Options());

  it('options should be used', async () => {
    await getSuite().emitAndWait();
  });
});
