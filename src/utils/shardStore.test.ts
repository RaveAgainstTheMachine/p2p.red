import { describe, expect, it } from 'vitest';
import { deleteShard, getShard, putShard } from './shardStore';

describe('shardStore', () => {
  it('stores and retrieves shards', async () => {
    const data = new TextEncoder().encode('chunk').buffer;
    await putShard('transfer-1', 1, data);

    const stored = await getShard('transfer-1', 1);
    expect(stored).not.toBeNull();
    expect(new Uint8Array(stored!)).toEqual(new Uint8Array(data));

    await deleteShard('transfer-1', 1);
    const deleted = await getShard('transfer-1', 1);
    expect(deleted).toBeNull();
  });
});
