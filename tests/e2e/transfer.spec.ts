import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

type TransferOptions = {
  name: string;
  sizeBytes: number;
  zip: boolean;
  pin?: string;
  fileType?: string;
};

const waitForPeer = async (page: any) => {
  await page.waitForFunction(() => (window as any).__peerConnected === true, null, { timeout: 60_000 });
};

const waitForE2E = async (page: any) => {
  await page.waitForFunction(() => (window as any).__e2e?.setFiles, null, { timeout: 30_000 });
};

const installMemoryFileSystem = async (page: any) => {
  await page.addInitScript(() => {
    const ensureBytes = (chunk: any) => {
      if (!chunk) return 0;
      if (typeof chunk === 'string') return new TextEncoder().encode(chunk).byteLength;
      if (chunk instanceof ArrayBuffer) return chunk.byteLength;
      if (ArrayBuffer.isView(chunk)) return chunk.byteLength;
      if (chunk?.data) {
        const data = chunk.data;
        if (data instanceof ArrayBuffer) return data.byteLength;
        if (ArrayBuffer.isView(data)) return data.byteLength;
      }
      return 0;
    };

    (window as any).__e2eFs = { bytes: 0, writes: 0 };

    (window as any).showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async (chunk: any) => {
          (window as any).__e2eFs.bytes += ensureBytes(chunk);
          (window as any).__e2eFs.writes += 1;
        },
        close: async () => {}
      })
    });
  });
};

const createShareLink = async (page: any, options: TransferOptions) => {
  await page.evaluate(({ name, sizeBytes, zip, pin, fileType }: TransferOptions) => {
    const buffer = new Uint8Array(sizeBytes);
    buffer.fill(65);
    const file = new File([buffer], name, { type: fileType ?? 'application/octet-stream' });
    (window as any).__e2e.setZip(zip);
    (window as any).__e2e.setPin(pin || '');
    (window as any).__e2e.setFiles([file]);
  }, options);

  await page.getByText(options.name, { exact: false }).waitFor({ timeout: 30_000 });
  await page.evaluate(() => (window as any).__e2e.createLink());

  await page.waitForFunction(() => (window as any).__e2e?.getShareLink?.(), null, { timeout: 90_000 });
  return page.evaluate(() => (window as any).__e2e.getShareLink());
};

const runTransfer = async (browser: any, options: TransferOptions) => {
  const transferTimeout = options.sizeBytes >= 20 * 1024 * 1024 ? 300_000 : 180_000;
  const senderContext = await browser.newContext();
  const receiverContext = await browser.newContext();

  await installMemoryFileSystem(receiverContext);

  const sender = await senderContext.newPage();
  const receiver = await receiverContext.newPage();

  await sender.goto('/');
  await receiver.goto('/');

  await waitForE2E(sender);
  await waitForE2E(receiver);

  await waitForPeer(sender);
  await waitForPeer(receiver);

  const shareLink = await createShareLink(sender, options);

  await receiver.goto(shareLink);

  await waitForE2E(receiver);
  await waitForPeer(receiver);

  if (options.pin) {
    await receiver.waitForFunction(() => (window as any).__e2e?.verifyPin, null, { timeout: 60_000 });
    await receiver.evaluate((pin: string) => (window as any).__e2e.verifyPin(pin), options.pin);
  }

  await receiver.waitForFunction(() => (window as any).__e2e?.getPendingReceive?.() === true, null, { timeout: 90_000 });
  await receiver.getByRole('button', { name: 'Start Download' }).click();

  if (!options.zip) {
    await sender.waitForFunction(() => (window as any).__e2e?.getStatus?.() === 'complete', null, { timeout: transferTimeout });
  }
  await receiver.getByText('File downloaded successfully!').waitFor({ timeout: transferTimeout });

  const expectedSize = await receiver.evaluate(() => (window as any).__e2e?.getIncomingFileInfo?.()?.size ?? 0);
  const receivedSize = await receiver.evaluate(() => (window as any).__e2eFs?.bytes ?? 0);
  if (options.zip) {
    expect(receivedSize).toBeGreaterThanOrEqual(expectedSize);
  } else {
    expect(receivedSize).toBe(expectedSize);
  }

  await senderContext.close();
  await receiverContext.close();
};

test('small file transfer (unzipped, no PIN)', async ({ browser }) => {
  await runTransfer(browser, {
    name: 'small.txt',
    sizeBytes: 64 * 1024,
    zip: false
  });
});

test('small file transfer (unzipped, with PIN)', async ({ browser }) => {
  await runTransfer(browser, {
    name: 'small-pin.txt',
    sizeBytes: 64 * 1024,
    zip: false,
    pin: '1234'
  });
});

test('small file transfer (zipped, with PIN)', async ({ browser }) => {
  await runTransfer(browser, {
    name: 'small-zip-pin.txt',
    sizeBytes: 128 * 1024,
    zip: true,
    pin: '4321'
  });
});

test('large file transfer (zipped, no PIN)', async ({ browser }) => {
  test.setTimeout(300_000);
  await runTransfer(browser, {
    name: 'large.zip',
    sizeBytes: 20 * 1024 * 1024,
    zip: true
  });
});
