import { Logger } from '@nestjs/common';
import {
  CustomTransportStrategy,
  MessageHandler,
  Server,
  Deserializer,
  IncomingEvent,
} from '@nestjs/microservices';
import { Message, Reader, ReaderConnectionConfigOptions } from 'nsqjs';

import { NSQContext } from './context';
import { RPCNotSupported } from './errors';
import { invariant } from './invariant';
import { NSQPattern } from './pattern';
import { StringDeserializer } from './serialization';
import { WaitGroup } from './wait-group';

type RequeueParams = Parameters<(typeof Message.prototype)['requeue']>;

export interface TopicChannelOptions extends ReaderConnectionConfigOptions {
  requeueParams?:
    | RequeueParams
    | ((message: Message, pattern: NSQPattern) => RequeueParams);
}

export interface NSQStrategyOptions {
  defaultChannelOptions?: TopicChannelOptions;
  channels?: Record<string, Record<string, TopicChannelOptions>>;
  deserializer?: Deserializer<Message, IncomingEvent>;
}

export class NSQStrategy extends Server implements CustomTransportStrategy {
  protected readonly logger = new Logger(NSQStrategy.name);
  private readonly readers = new Map<string, Reader>();
  private readonly handlingMessagesWG = new WaitGroup();

  constructor(private readonly opts: NSQStrategyOptions) {
    super();
    this.deserializer = opts.deserializer ?? new StringDeserializer();
  }

  async listen(callback?: () => void) {
    await Promise.all(
      [...this.readers.values()].map(
        (reader) =>
          new Promise<void>((res, rej) => {
            reader.on('ready', res);
            reader.on('error', rej);
            reader.connect();
          }),
      ),
    );

    this.logger.log('start listening to messages');
    if (callback) callback();
  }

  addHandler(
    pattern: unknown,
    callback: MessageHandler,
    isEventHandler?: boolean,
    extras?: Record<string, unknown>,
  ): void {
    const parsed = NSQPattern.parse(pattern);
    if (!parsed)
      return this.logger.debug(
        `skipping handler with pattern: ${JSON.stringify(pattern)}`,
      );

    if (!isEventHandler) throw new RPCNotSupported();

    const reader: Reader = this.createOrGetReaderFor(parsed);

    reader.on(
      parsed.discard ? 'discard' : 'message',
      this.handleMessage(parsed),
    );

    super.addHandler(pattern, callback, isEventHandler, extras);
  }

  async close() {
    for (const reader of this.readers.values()) {
      reader.pause();
    }

    await this.handlingMessagesWG.wait();

    for (const reader of this.readers.values()) {
      reader.close();
    }
  }

  private createOrGetReaderFor(pattern: NSQPattern): Reader {
    const existing = this.readers.get(pattern.toString(true));
    if (existing) return existing;

    const reader = this.createReaderFor(pattern);
    this.readers.set(pattern.toString(true), reader);
    return reader;
  }

  private createReaderFor(pattern: NSQPattern): Reader {
    const { topic, channel } = pattern;
    const { requeueParams: _, ...readerOpts } =
      this.getOptionsByPattern(pattern);

    const reader = new Reader(topic, channel, readerOpts);

    const logPrefix = `reader for topic ${topic} and channel ${channel} status:`;

    reader.on('not_ready', () => this.logger.log(`${logPrefix} not ready`));
    reader.on('nsqd_connected', (host, port) =>
      this.logger.log(`${logPrefix} not connected to nsqd ${host}:${port}`),
    );
    reader.on('nsqd_closed', (host, port) =>
      this.logger.log(`${logPrefix} nsqd closed ${host}:${port}`),
    );
    reader.on('error', (error) => this.logger.error(`${logPrefix} ${error}`));

    return reader;
  }

  private getOptionsByPattern(pattern: NSQPattern): TopicChannelOptions {
    return Object.assign(
      {},
      this.opts.defaultChannelOptions,
      this.opts.channels?.[pattern.topic]?.[pattern.channel],
    );
  }

  private handleMessage(pattern: NSQPattern) {
    return async (message: Message) => {
      this.handlingMessagesWG.add(1);

      const handler = this.getHandlerByPattern(pattern.toString());
      invariant(handler, `no handler for pattern ${pattern}`);

      const logAttributes = `message id=${message.id} attempt=${
        message.attempts
      } timestamp=${message.timestamp} topic=${pattern.topic} channel=${
        pattern.channel
      }${pattern.discard ? ' discarded' : ''}`;

      this.logger.verbose(`${logAttributes} to be processed`);
      let success = false;

      try {
        const packet = await this.deserializer.deserialize(message, {
          pattern,
        });
        const ctx = new NSQContext([message, pattern]);
        const result = await handler(packet.data, ctx);
        if (result) await result.toPromise();
        this.logger.debug(`${logAttributes} handled successfully`);
        message.finish();
        success = true;
      } catch (e) {
        let serializedError = String(e);
        if (serializedError === objectObject) {
          try {
            serializedError = JSON.stringify(e);
          } catch {}
        }

        this.logger.debug(
          `error thrown while processing ${logAttributes}: ${serializedError}`,
        );
        const { requeueParams } = this.getOptionsByPattern(pattern);
        // skipping coverage as it will make test too long with default values
        /* istanbul ignore next */
        if (!requeueParams) message.requeue();
        else if (Array.isArray(requeueParams))
          message.requeue(...requeueParams);
        else message.requeue(...requeueParams(message, pattern));
        this.logger.debug(`${logAttributes} requeued`);
      } finally {
        this.logger.verbose(
          `${logAttributes} processed ${
            success ? 'successfully' : 'with error'
          }`,
        );
        this.handlingMessagesWG.done();
      }
    };
  }
}

const objectObject = {}.toString();
