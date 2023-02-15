export class NSQPattern {
  static readonly DELIMITER = '/';
  static readonly DISCARD_SUFFIX = 'discard';

  static parse(pattern: unknown): NSQPattern | null {
    if (typeof pattern !== 'string') return null;

    const [topic, channel, discard, ...rest] = pattern.split(
      NSQPattern.DELIMITER,
    );

    if (
      !topic ||
      !channel ||
      (discard && discard !== NSQPattern.DISCARD_SUFFIX) ||
      rest.length > 0
    )
      return null;

    return new NSQPattern(
      topic,
      channel,
      discard === NSQPattern.DISCARD_SUFFIX,
    );
  }

  constructor(
    readonly topic: string,
    readonly channel: string,
    readonly discard = false,
  ) {}

  toString(skipDiscard = false): string {
    const parts = [this.topic, this.channel];
    if (!skipDiscard && this.discard) parts.push(NSQPattern.DISCARD_SUFFIX);
    return parts.join(NSQPattern.DELIMITER);
  }
}
