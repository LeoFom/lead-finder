import { createDatabase } from './index.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const localEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);
export async function seed(db: ReturnType<typeof createDatabase>) {
  const country = await db.country.upsert({
    where: { iso2: 'UA' },
    update: {},
    create: { iso2: 'UA', nameUk: 'Україна', nameEn: 'Ukraine' },
  });
  for (const [name, slug] of [
    ['Івано-Франківськ', 'ivano-frankivsk'],
    ['Львів', 'lviv'],
    ['Київ', 'kyiv'],
    ['Тернопіль', 'ternopil'],
  ] as const) {
    await db.city.upsert({
      where: { countryId_region_slug: { countryId: country.id, region: '', slug } },
      update: {},
      create: { countryId: country.id, name, slug },
    });
  }
  await db.licenseRegistry.upsert({
    where: { id: 'owner-original-v1' },
    update: {},
    create: {
      id: 'owner-original-v1',
      sourceName: 'Власні незалежні спостереження',
      licenseCode: 'owner-original-v1',
      version: '1',
      attributionText: 'Власна перевірка користувача Lead Finder',
      allowStorage: true,
      allowExport: true,
    },
  });
}
if (process.argv[1]?.endsWith('/seed.js') || process.argv[1]?.endsWith('\\seed.js')) {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    await seed(db);
  } finally {
    await db.$disconnect();
  }
}
