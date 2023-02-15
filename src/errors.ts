export class RPCNotSupported extends Error {
  constructor() {
    super('request-response messages are not supported');
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
