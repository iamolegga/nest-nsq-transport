import { BaseRpcContext } from '@nestjs/microservices/ctx-host/base-rpc.context';
import { Message } from 'nsqjs';

import { NSQPattern } from './pattern';

type NSQContextArgs = [Message, NSQPattern];

export class NSQContext extends BaseRpcContext<NSQContextArgs> {
  get message(): Message {
    return this.getArgByIndex(0);
  }

  get pattern(): NSQPattern {
    return this.getArgByIndex(1);
  }
}
