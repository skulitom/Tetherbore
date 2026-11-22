// The save file: everything the game keeps, as one gzipped file in the folder Steam Auto-Cloud is pointed at. It is
// written beside itself and renamed into place, and the last good copy is kept as `.bak`, so that a machine that
// dies mid-write loses a few seconds and not the game.
const fs = require('node:fs/promises');
const path = require('node:path');
const v8 = require('node:v8');
const zlib = require('node:zlib');
const { promisify } = require('node:util');

const gzip = promisify(zlib.gzip), gunzip = promisify(zlib.gunzip);
const NAME = 'tetherbore.save';

function open(folder) {
  const file = path.join(folder, NAME), bak = `${file}.bak`, tmp = `${file}.tmp`;
  let queue = Promise.resolve();

  async function load(from) {
    const data = v8.deserialize(await gunzip(await fs.readFile(from)));
    if (!data || typeof data.keys !== 'object' || !Array.isArray(data.pieces)) throw new Error('not a save');
    return data;
  }
  return {
    file,
    async read() {
      for (const from of [file, bak]) { try { return await load(from); } catch { /* the next copy */ } }
      return null;
    },
    write(data) {
      const job = queue.then(async () => {
        const body = await gzip(v8.serialize({ keys: data.keys, pieces: data.pieces }), { level: 6 });
        await fs.mkdir(folder, { recursive: true });
        await fs.writeFile(tmp, body);
        await load(tmp);   // what was written reads back, before it replaces anything
        await fs.rm(bak, { force: true });
        await fs.rename(file, bak).catch(error => { if (error.code !== 'ENOENT') throw error; });
        await fs.rename(tmp, file);
      });
      queue = job.catch(() => {});
      return job;
    },
  };
}

module.exports = { open, NAME };
