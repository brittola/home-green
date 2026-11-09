import { WebClient } from '@slack/web-api';

export interface SlackPoster {
  post(text: string): Promise<void>;
}

export function createSlackPoster(token: string, channelId: string): SlackPoster {
  const client = new WebClient(token, { retryConfig: { retries: 2 } });
  return {
    async post(text) {
      const res = await client.chat.postMessage({ channel: channelId, text, unfurl_links: false });
      if (!res.ok) throw new Error(`Slack chat.postMessage failed: ${res.error ?? 'unknown'}`);
    },
  };
}
