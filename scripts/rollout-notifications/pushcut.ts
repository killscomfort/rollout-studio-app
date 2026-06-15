interface PushcutOptions {
  apiKey: string;
  notificationName: string;
  title: string;
  text: string;
  link?: string;
}

export async function sendPushcut(opts: PushcutOptions): Promise<void> {
  const body: Record<string, unknown> = { title: opts.title, text: opts.text };
  if (opts.link) {
    body.actions = [{ name: "Open", url: opts.link }];
  }

  const response = await fetch(
    `https://api.pushcut.io/v1/notifications/${encodeURIComponent(opts.notificationName)}`,
    {
      method: "POST",
      headers: { "API-Key": opts.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Pushcut error ${response.status}: ${detail}`);
  }
}
