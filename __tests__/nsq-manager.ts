import { request } from 'http';

export class NSQManager {
  constructor(private nsqdUrl: string) {}

  async recreateTopic(topic: string) {
    await this.deleteTopic(topic).catch(noop); // ignore error
    return this.makeRequest(`/topic/create?topic=${topic}`);
  }

  async deleteTopic(topic: string) {
    await this.makeRequest(`/topic/delete?topic=${topic}`);
  }

  async recreateChannel(topic: string, channel: string) {
    await this.deleteChannel(topic, channel).catch(noop); // ignore error
    return this.makeRequest(
      `/channel/create?topic=${topic}&channel=${channel}`,
    );
  }

  async deleteChannel(topic: string, channel: string) {
    await this.makeRequest(`/channel/delete?topic=${topic}&channel=${channel}`);
  }

  private makeRequest(path: string) {
    return new Promise<void>((resolve, reject) => {
      const req = request(this.nsqdUrl + path, { method: 'POST' }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`${res.statusCode} ${res.statusMessage}`));
        } else {
          resolve();
        }
      });
      req.shouldKeepAlive = false;
      req.on('error', reject);
      req.end();
    });
  }
}

function noop() {}
