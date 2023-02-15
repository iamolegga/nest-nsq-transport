export class Deferred {
  readonly promise: Promise<void>;
  private _resolve!: () => void;
  private _reject!: (err: Error) => void;

  constructor() {
    this.promise = new Promise<void>((res, rej) => {
      this._resolve = res;
      this._reject = rej;
    });
  }

  get resolve() {
    return this._resolve;
  }

  get reject() {
    return this._reject;
  }
}
