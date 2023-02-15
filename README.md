# nest-nsq-transport

<p align="center">
  <a href="https://www.npmjs.com/package/nest-nsq-transport">
    <img alt="npm" src="https://img.shields.io/npm/v/nest-nsq-transport" />
  </a>
  <a href="https://github.com/iamolegga/nest-nsq-transport/actions/workflows/on-push.yml?query=branch%3Amain">
    <img alt="GitHub Workflow Status (with branch)" src="https://img.shields.io/github/actions/workflow/status/iamolegga/nest-nsq-transport/on-push.yml?branch=main">
  </a>
  <a href="https://codeclimate.com/github/iamolegga/nest-nsq-transport/test_coverage">
    <img src="https://api.codeclimate.com/v1/badges/275a42d99fb390a6b2e2/test_coverage" />
  </a>
  <a href="https://snyk.io/test/github/iamolegga/nest-nsq-transport">
    <img alt="Snyk Vulnerabilities for npm package" src="https://img.shields.io/snyk/vulnerabilities/npm/nest-nsq-transport" />
  </a>
  <a href="https://libraries.io/npm/nest-nsq-transport">
    <img alt="Libraries.io" src="https://img.shields.io/librariesio/release/npm/nest-nsq-transport">
  </a>
  <img alt="Dependabot" src="https://badgen.net/github/dependabot/iamolegga/nest-nsq-transport" />
  <img alt="Installs" src="https://img.shields.io/npm/dm/nest-nsq-transport" />
</p>

The most basic and unopinionated implementation of [NSQ](https://nsq.io/) transport for NestJS microservices.

`finish()` is called automatically when no errors are thrown while handling, otherwise `requeue()` is called.

---

<p align="center"><b>No request-response messaging support and it won't be added, as it's better to use appropriate RPC transports</b></p>

---

## install

```sh
npm i nest-nsq-transport nsqjs
npm i -D @types/nsqjs
```

## configure

### setup server:

```ts
import { Message } from 'nsqjs';
import { NSQStrategy, NSQStrategyOptions, NSQPattern } from 'nest-nsq-transport';

NestFactory.createMicroservice(
  AppModule,
  {
    strategy: new NSQStrategy(<NSQStrategyOptions>{
      // Optional deserializer, please see implementation in the sources.
      //
      // Default deserializer converts message data from Buffer to utf8 string.
      // Could be replaced with the built-in JSONDeserializer or a custom one.
      deserializer: new MyDeserializer();

      // optional default options that will be passed to all nsqjs.Reader's of
      // each channel. It's possible to skip this field and describe options
      // for each channel separately with `channels` field
      defaultChannelOptions: {
        nsqdTCPAddresses: [process.env.NSQD_TCP_ADDR],
        // or
        lookupdHTTPAddresses: [process.env.LOOKUPD_HTTP_ADDR],

        // and all the other options, see here:
        // https://github.com/dudleycarr/nsqjs#new-readertopic-channel-options

        // with one extra option:
        // as `requeue` is called automatically on error, there is no way to
        // pass parameters, but it's possible to provide either default args:
        requeueParams: [1, true],
        // or a callback
        requeueParams: (message: Message, pattern: NSQPattern) => [1, true],
      },

      // Optional map of topic -> channel -> options
      channels: {
        'my-topic': {
          'my-channel': {
            // this will be merged with the defaultChannelOptions
          },
        },
      },
    });
  },
)
```

### setup client:

```ts
import { ClientsModule } from '@nestjs/microservices';
import { NSQClient, NSQClientOpitons } from 'nest-nsq-transport';

export const clientToken = Symbol();

@Module({
  imports: [
    ClientsModule.register([
      {
        name: clientToken,
        customClass: NSQClient,
        options: <NSQClientOpitons>{
          // Optional serializer, please see implementation in the sources.
          // 
          // Default serializer converts emitted data to a string and pass it as
          // a Buffer to nsqjs.Writer.publish method. Could be replaced with the
          // built-in JSONSerializer or a custom one.
          serializer: new MySerializer(),

          // Connections options:
          // ether full nsqd tcp address
          nsqdURL: process.env.NSQD_TCP_ADDR, // in `host:port` pattern
          // or host and port separately
          nsqdHost: process.env.NSQD_HOST,
          nsqdPort: Number(process.env.NSQD_PORT),

          // Other options from nsqjs.ConnectionConfigOptions, see here:
          // https://github.com/dudleycarr/nsqjs#new-writernsqdhost-nsqdport-options
          // ...
        },
      },
    ]),
  ],
})
class AppModule {}
```

## usage

```ts
import { ClientProxy, EventPattern, Payload, Ctx } from '@nestjs/microservices';
import { NSQContext } from 'nest-nsq-transport';

@Controller()
class TestController {
  constructor(
    // Token that passed to ClientsModule.register
    @Inject(clientToken) private readonly client: ClientProxy
  ) {}

  // To get only payload no decorators needed
  @EventPattern('my-topic/my-channel')
  async handle(payload: MyType) {
    //
  }

  // Decorators are required to get context
  @EventPattern('my-topic/my-channel-two')
  async handle(
    @Payload() payload: MyType,
    @Ctx() ctx: NSQContext
  ) {
    // 
  }

  async emit() {
    // This is an example how to emit data. Serializer which converts data to
    // Buffer have to be provided when client is registered. There are two
    // built-in serializers: JSONSerializer and StringSerializer
    await this.client.emit('my-topic', data as MyType).toPromise();
  }

  // Also if `maxAttempts` is set in NSQStrategyOptions message could be
  // discarded. It's possible to subscribe on discarded messages in a separate
  // handler adding `/discard` suffix to pattern. If `maxAttempts` is set and
  // such separate discard-handler is not provided then discarded message will
  // be sent to the original handler again. But it's always possible to check
  // current attempt with `ctx.message.attempts`, which starts from 1.
  @EventPattern('my-topic/my-channel/discard')
  async handle(
    @Payload() payload: MyType,
    @Ctx() ctx: NSQContext
  ) {
    await this.client.emit(
      `${ctx.pattern.topic}-${ctx.pattern.channel}-dead-letter`,
      payload,
    ).toPromise()
  }
}
```

<h2 align="center">Do you use this library?<br/>Don't be shy to give it a star! ★</h2>

<h3 align="center">Also if you are into NestJS you might be interested in one of my <a href="https://github.com/iamolegga#nestjs">other NestJS libs</a>.</h3>
