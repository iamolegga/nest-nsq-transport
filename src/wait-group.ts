import { Deferred } from './deferred';

export class WaitGroup {
  private deferred = new Deferred();
  private count = 0;
  private waiting = false;

  add(x: number) {
    this.count += x;
  }

  done() {
    this.count--;
    if (this.waiting && this.count <= 0) {
      this.deferred.resolve();
    }
  }

  async wait() {
    this.waiting = true;
    if (this.count <= 0) this.deferred.resolve();
    return this.deferred.promise;
  }
}
