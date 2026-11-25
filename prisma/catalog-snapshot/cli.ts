import type { Catalog } from './schema';
import { exportSnapshot } from './export';
import { importSnapshot } from './import';
import { loadSnapshot } from './snapshot';

function connection(name: 'DATABASE_URL' | 'CATALOG_SOURCE_DATABASE_URL') {
  const url = process.env[name];
  if (!url) throw new Error('Set ' + name + ' in the command environment.');
  return url;
}

export async function runSnapshotSeed(catalog?: Catalog) {
  const result = await importSnapshot(connection('DATABASE_URL'), catalog);
  console.log(JSON.stringify(result, null, 2));
}

export function reportSeedError(error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function main([command, ...args]: string[]) {
  if (command === 'export' && args.length === 2) {
    const manifest = await exportSnapshot(
      connection('CATALOG_SOURCE_DATABASE_URL'),
      args[0],
      args[1],
    );
    console.log(JSON.stringify(manifest, null, 2));
  } else if (command === 'validate' && args.length <= 1) {
    const { manifest } = loadSnapshot(args[0]);
    console.log(JSON.stringify(manifest, null, 2));
  } else if (command === 'import' && args.length === 0) {
    await runSnapshotSeed();
  } else {
    throw new Error(
      'Usage: export <version> <new-directory> | validate [directory] | import',
    );
  }
}

if (require.main === module) {
  void main(process.argv.slice(2)).catch(reportSeedError);
}
