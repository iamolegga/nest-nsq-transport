import {
  INestMicroservice,
  Module,
  ModuleMetadata,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClientsModule } from '@nestjs/microservices';

import { NSQClient, NSQClientOpitons, NSQStrategy, NSQPattern } from '../src';
import { Deferred } from '../src/deferred';
import { invariant } from '../src/invariant';
import { WaitGroup } from '../src/wait-group';

import { NSQManager } from './nsq-manager';

export abstract class Base {
  static readonly nsqdTCP = getEnv('NSQD_TCP_URL');
  static readonly nsqdHTTP = getEnv('NSQD_HTTP_URL');
  protected abstract patterns: NSQPattern[];

  protected manager = new NSQManager(Base.nsqdHTTP);
  protected app!: INestMicroservice;
  protected wg!: WaitGroup;
  protected clientToken = Symbol();
  protected strategy = new NSQStrategy({
    defaultChannelOptions: { nsqdTCPAddresses: [Base.nsqdTCP] },
  });
  protected awaitListeningInBeforeHook = true;
  protected listening = new Deferred();

  async before() {
    this.wg = new WaitGroup();
    await this.setupNSQ();
    const listening = this.listening;
    const isWaitingForListening = this.awaitListeningInBeforeHook;

    @Module(this.metadata)
    class TestModule implements OnApplicationBootstrap {
      async onApplicationBootstrap() {
        if (isWaitingForListening) listening.resolve();
      }
    }

    this.app = await NestFactory.createMicroservice(TestModule, {
      logger: ['debug', 'verbose'],
      strategy: this.strategy,
    });

    try {
      await this.app.init();
    } catch (err) {
      this.listening.reject(<Error>err);
      return;
    }

    // listen blocks the thread, so we don't need to await it
    void this.app.listen().catch((err) => this.listening.reject(err));

    if (this.awaitListeningInBeforeHook) await this.listening.promise;
  }

  async after() {
    if (this.awaitListeningInBeforeHook) await this.app.close();
    await this.teardownNSQ();
  }

  protected get metadata(): ModuleMetadata {
    return {
      imports: [
        ClientsModule.register([
          {
            name: this.clientToken,
            customClass: NSQClient,
            options: <NSQClientOpitons>{ nsqdURL: Base.nsqdTCP },
          },
        ]),
      ],
    };
  }

  private async setupNSQ() {
    const topics = new Set<string>();
    for (const pattern of this.patterns) {
      if (!topics.has(pattern.topic)) {
        await this.manager.recreateTopic(pattern.topic);
        topics.add(pattern.topic);
      }
      await this.manager.recreateChannel(pattern.topic, pattern.channel);
    }
  }

  private async teardownNSQ() {
    const topics = new Set<string>();
    for (const pattern of this.patterns) {
      if (!topics.has(pattern.topic)) {
        await this.manager.deleteChannel(pattern.topic, pattern.channel);
        topics.add(pattern.topic);
      }
      await this.manager.deleteTopic(pattern.topic).catch(noop);
    }
  }
}

function noop() {}

function getEnv(name: string): string {
  const value = process.env[name];
  invariant(value, `${name} is empty`);
  return value;
}
