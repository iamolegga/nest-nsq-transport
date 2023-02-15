import { Logger } from '@nestjs/common';
import {
  ClientProxy,
  ReadPacket,
  WritePacket,
  OutgoingEvent,
  Serializer,
} from '@nestjs/microservices';
import { Writer, ConnectionConfigOptions } from 'nsqjs';

import { RPCNotSupported } from './errors';
import { invariant } from './invariant';
import { StringSerializer } from './serialization';

export type Publishable = Parameters<typeof Writer.prototype.publish>[1];
export type NSQClientOpitons = ConnectionConfigOptions &
  ({ nsqdHost: string; nsqdPort: number } | { nsqdURL: string }) & {
    serializer?: Serializer<OutgoingEvent, Publishable>;
  };

export class NSQClient extends ClientProxy {
  private readonly writer: Writer;
  private readonly logger = new Logger(NSQClient.name);
  private connected?: Promise<void>;

  constructor(private readonly opts: NSQClientOpitons) {
    super();

    if ('nsqdURL' in opts) {
      const { nsqdURL, serializer: _, ...rest } = opts;
      const [hostname, port] = opts.nsqdURL.split(':');
      if (!hostname || !port) throw new Error('Invalid nsqdURL');
      this.writer = new Writer(hostname, Number(port), rest);
    } else {
      const { nsqdHost, nsqdPort, serializer: _, ...rest } = opts;
      this.writer = new Writer(nsqdHost, nsqdPort, rest);
    }

    this.serializer = opts.serializer ?? new StringSerializer();
  }

  connect(): Promise<void> {
    if (this.connected) return this.connected;

    this.connected = new Promise<void>((resolve, reject) => {
      this.writer
        .on('ready', () => {
          this.logger.debug('NSQ client connected');
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`NSQ client connection error: ${err}`);
          reject();
        });
      this.writer.connect();
    });

    return this.connected;
  }

  close() {
    return new Promise<void>((resolve, reject) => {
      this.writer
        .on('closed', () => {
          this.logger.debug('NSQ client closed');
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`NSQ client closing error: ${err}`);
          reject();
        });
      this.writer.close();
    });
  }

  publish(
    _packet: ReadPacket<unknown>,
    _callback: (packet: WritePacket<unknown>) => void,
  ): () => void {
    throw new RPCNotSupported();
  }

  // something with types, unable to set void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async dispatchEvent(packet: ReadPacket<unknown>): Promise<any> {
    invariant(
      typeof packet.pattern === 'string',
      'pattern must be a valid topic name',
    );
    const data = await this.serializer.serialize(packet);
    return new Promise<void>((resolve, reject) =>
      this.writer.publish(packet.pattern, data, (err) =>
        err ? reject(err) : resolve(),
      ),
    );
  }
}
