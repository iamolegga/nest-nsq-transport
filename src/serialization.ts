import {
  ConsumerDeserializer,
  ProducerSerializer,
  IncomingEvent,
  OutgoingEvent,
} from '@nestjs/microservices';
import { Message } from 'nsqjs';

export class JSONDeserializer implements ConsumerDeserializer {
  deserialize(value: Message, opts: { pattern: string }): IncomingEvent {
    return {
      data: JSON.parse(value.body.toString('utf8')),
      pattern: opts.pattern,
    };
  }
}

export class JSONSerializer implements ProducerSerializer {
  serialize(value: OutgoingEvent) {
    return Buffer.from(JSON.stringify(value.data));
  }
}

export class StringDeserializer implements ConsumerDeserializer {
  deserialize(value: Message, opts: { pattern: string }): IncomingEvent {
    return {
      data: value.body.toString('utf8'),
      pattern: opts.pattern,
    };
  }
}

export class StringSerializer implements ProducerSerializer {
  serialize(value: OutgoingEvent) {
    return Buffer.from(String(value.data));
  }
}
