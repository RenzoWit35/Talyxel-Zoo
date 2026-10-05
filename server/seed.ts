/**
 * Fills an empty database with demo builders, zoos, photos, surveys and follows.
 * Usage: npm run seed   (uses DATA_DIR, default ./data)
 */
import { mkdirSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Biome, HabitatKind, HabitatStatus, ParkType } from '../shared/constants';
import type { Point } from '../shared/geometry';
import type { Habitat, ZooDetail } from '../shared/types';
import { createApp } from './app';
import { all, one, openDb, run } from './db';
import { paintPostcard, type Feature } from './seed-images';

const PASSWORD = 'zoo-demo-123';
const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
mkdirSync(dataDir, { recursive: true });
const db = openDb(path.join(dataDir, 'talyxel.db'));

if (one(db, 'SELECT 1 FROM users LIMIT 1')) {
  console.log('The database already has users — skipping the seed. Delete the data/ folder to start fresh.');
  process.exit(0);
}

const app = createApp({ db, uploadDir: path.join(dataDir, 'uploads') });
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

class Client {
  cookie = '';
  async call<T>(method: string, url: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'x-talyxel': '1', cookie: this.cookie };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + url, { method, headers, body: payload });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const data = await res.json();
    if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${JSON.stringify(data)}`);
    return data as T;
  }
}

interface HabitatSeed {
  name: string;
  kind?: HabitatKind;
  status?: HabitatStatus;
  biome?: Biome;
  species?: string;
  description?: string;
  color?: string;
  points: Point[];
  photos?: string[]; // captions; one generated postcard each
  /** Added after publishing, so it shows up in followers' feeds. */
  later?: boolean;
}

interface ZooSeed {
  parkType?: ParkType;
  title: string;
  description: string;
  width: number;
  height: number;
  habitats: HabitatSeed[];
  publish?: { survey?: { question: string; options: string[]; allowSuggestions?: boolean } };
}

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

let photoSeed = 1;

/** Theme park photos get a coaster track or a Ferris wheel painted in. */
const featureFor = (h: Pick<HabitatSeed, 'kind' | 'species'>): Feature | undefined =>
  h.kind === 'coaster' ? 'coaster' : h.species?.toLowerCase().includes('ferris') ? 'wheel' : undefined;

async function createZoo(owner: Client, z: ZooSeed) {
  const zoo = await owner.call<ZooDetail>('POST', '/zoos', {
    parkType: z.parkType ?? 'zoo',
    title: z.title,
    description: z.description,
    width: z.width,
    height: z.height,
  });
  const addHabitat = async ({ photos = [], later: _later, ...fields }: HabitatSeed) => {
    const created = await owner.call<Habitat>('POST', `/zoos/${zoo.id}/habitats`, fields);
    if (!photos.length) return;
    const form = new FormData();
    for (let i = 0; i < photos.length; i++) {
      const png = paintPostcard(fields.biome ?? '', photoSeed++ * 7919, featureFor(fields));
      form.append('photos', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'postcard.png');
    }
    const withPhotos = await owner.call<Habitat>('POST', `/habitats/${created.id}/photos`, form);
    for (const [i, p] of withPhotos.photos.entries()) await owner.call('PATCH', `/photos/${p.id}`, { caption: photos[i] });
  };
  for (const h of z.habitats.filter((x) => !x.later)) await addHabitat(h);
  if (z.publish) await owner.call('POST', `/zoos/${zoo.id}/publish`, z.publish);
  for (const h of z.habitats.filter((x) => x.later)) await addHabitat(h);
  return zoo.id;
}

async function main() {
  const users: Record<string, Client> = {};
  const people = [
    { username: 'talyxel', displayName: 'Talyxel', bio: 'Rainforests, big cats and way too many terraforming hours. Building the Talyxel Reserve one habitat at a time.' },
    { username: 'rosa', displayName: 'Rosa Verhoeven', bio: 'Savanna specialist. Every lion deserves a view.' },
    { username: 'kai', displayName: 'Kai Lindqvist', bio: 'Cold-climate conservation parks. Snow, wolves and northern lights.' },
    { username: 'milan', displayName: 'Milan de Vries', bio: 'Reptile houses and aquariums. Glass is my love language.' },
    { username: 'lotte', displayName: 'Lotte Bakker', bio: "Planet Coaster addict. If it doesn't have a loop, is it even a ride?" },
  ];
  for (const p of people) {
    const c = new Client();
    await c.call('POST', '/auth/register', { username: p.username, password: PASSWORD, displayName: p.displayName });
    await c.call('PATCH', '/auth/me', { bio: p.bio });
    users[p.username] = c;
  }

  const follow = (a: string, b: string) => users[a].call('PUT', `/users/${b}/follow`);
  await follow('talyxel', 'rosa');
  await follow('talyxel', 'kai');
  await follow('rosa', 'talyxel');
  await follow('kai', 'rosa');
  await follow('milan', 'talyxel');
  await follow('milan', 'rosa');
  await follow('talyxel', 'lotte');
  await follow('lotte', 'talyxel');
  await follow('rosa', 'lotte');

  // Rosa: a published savanna park with an open survey.
  const serengeti = await createZoo(users.rosa, {
    title: 'Serengeti Crossroads',
    description: 'A franchise-mode savanna park built around one big loop path. Every habitat gets an overlook and the lions get the hill.',
    width: 400,
    height: 260,
    publish: {
      survey: {
        question: 'What should I add to Serengeti Crossroads next?',
        options: ['Okapi forest', 'Spotted Hyena den', 'Flamingo lagoon'],
        allowSuggestions: true,
      },
    },
    habitats: [
      { name: 'Main loop', kind: 'path', status: 'done', points: [[20, 122], [380, 122], [380, 138], [20, 138]] },
      { name: 'North path', kind: 'path', status: 'done', points: [[192, 10], [208, 10], [208, 122], [192, 122]] },
      {
        name: 'Lion Kopje',
        species: 'West African Lion',
        biome: 'grassland',
        status: 'done',
        color: '#c79a3c',
        description: 'Rocky kopje with heated rocks, a log bridge viewing area and the hill everyone climbs for sunset.',
        points: [[20, 14], [176, 10], [184, 108], [96, 116], [26, 96]],
        photos: ['Sunset over the kopje', 'The pride on the heated rocks', 'Glass overlook from the main loop'],
      },
      {
        name: 'Giraffe Plains',
        species: 'Reticulated Giraffe',
        biome: 'grassland',
        status: 'done',
        color: '#d9733f',
        description: 'Mixed habitat for giraffes and zebras with an elevated feeding platform for guests.',
        points: rect(222, 12, 160, 98),
        photos: ['Feeding platform', 'Morning on the plains'],
      },
      {
        name: 'Elephant Valley',
        species: 'African Savannah Elephant',
        biome: 'grassland',
        status: 'building',
        color: '#5f9e5c',
        description: 'Largest habitat in the park. Deep pool, mud wallow and a barn at the back. Terraforming done, still placing trees.',
        points: [[20, 152], [190, 150], [196, 248], [70, 250], [22, 220]],
        photos: ['Pool in progress'],
      },
      { name: 'Hippo River', kind: 'water', biome: 'aquatic', status: 'building', points: [[60, 196], [140, 186], [158, 206], [118, 228], [70, 222]] },
      {
        name: 'Cheetah Run',
        species: 'Cheetah',
        biome: 'grassland',
        status: 'planned',
        color: '#93b85c',
        description: 'Long and narrow so they can actually sprint. Planning a lure track enrichment.',
        points: rect(212, 152, 168, 40),
        later: true,
      },
      { name: 'Savanna Market', kind: 'facility', status: 'done', points: rect(212, 204, 60, 44), description: 'Food court, restrooms and the gift shop.' },
      { name: 'Okapi forest', species: 'Okapi', biome: 'tropical', status: 'idea', points: rect(286, 204, 94, 44), description: 'Maybe? Depends on the survey.', later: true },
    ],
  });

  // Kai: a published cold-climate park.
  await createZoo(users.kai, {
    title: 'Northern Lights Park',
    description: 'Taiga and tundra species around a frozen lake. Built on a challenge-mode map with harsh winters.',
    width: 320,
    height: 300,
    publish: {
      survey: { question: 'Which cold-climate animal should move in next?', options: ['Snow Leopard', 'Moose', 'Arctic Fox family'], allowSuggestions: true },
    },
    habitats: [
      { name: 'Frozen Lake', kind: 'water', biome: 'aquatic', status: 'done', points: [[110, 110], [210, 100], [230, 170], [170, 200], [100, 176]] },
      {
        name: 'Polar Bear Coast',
        species: 'Polar Bear',
        biome: 'tundra',
        status: 'building',
        color: '#4fb3a9',
        description: 'Deep diving pool with underwater viewing. Need more ice rocks.',
        points: [[16, 14], [150, 12], [150, 90], [90, 96], [18, 80]],
        photos: ['Underwater viewing tunnel', 'Coastline'],
      },
      {
        name: 'Wolf Woods',
        species: 'Arctic Wolf',
        biome: 'taiga',
        status: 'done',
        color: '#3e7a5a',
        description: 'Dense pine forest with a den and a stream.',
        points: [[170, 14], [304, 14], [304, 86], [232, 92], [172, 76]],
        photos: ['Pack at dusk', 'The den', 'Stream crossing'],
      },
      {
        name: 'Snow Leopard Ridge',
        species: 'Snow Leopard',
        biome: 'tundra',
        status: 'planned',
        color: '#9c8a6e',
        description: 'Steep cliffs on the east side. Climbing frames + heated rocks.',
        points: [[244, 112], [304, 108], [304, 220], [252, 214]],
        later: true,
      },
      { name: 'Ranger Lodge', kind: 'facility', status: 'done', points: rect(20, 220, 70, 60), description: 'Staff room, workshop and a warm café.' },
      { name: 'Lakeside trail', kind: 'path', status: 'done', points: [[20, 200], [240, 232], [240, 246], [20, 214]] },
    ],
  });

  // Talyxel: one published rainforest reserve and one private draft.
  await createZoo(users.talyxel, {
    title: 'Talyxel Rainforest Reserve',
    description: 'Dense jungle walkways, a temple ruin theme and lots of verticality. My main project — feedback very welcome!',
    width: 360,
    height: 240,
    publish: {
      survey: { question: 'What should I add to Talyxel Rainforest Reserve next?', options: ['Red Panda hill', 'Komodo dragon house', 'Jaguar temple'], allowSuggestions: true },
    },
    habitats: [
      { name: 'Jungle walk', kind: 'path', status: 'done', points: [[10, 112], [350, 104], [350, 120], [10, 128]] },
      {
        name: 'Orangutan Canopy',
        species: 'Bornean Orangutan',
        biome: 'tropical',
        status: 'done',
        color: '#3e7a5a',
        description: 'Tall climbing towers connected with ropes, plus a waterfall.',
        points: [[14, 12], [150, 10], [160, 96], [20, 100]],
        photos: ['Rope bridges', 'Waterfall corner', 'From the guest bridge'],
      },
      {
        name: 'Tiger Temple',
        species: 'Sumatran Tiger',
        biome: 'tropical',
        status: 'building',
        color: '#d9733f',
        description: 'Ruined temple pieces, a deep pool and a glass wall into the river.',
        points: [[176, 14], [344, 18], [338, 92], [250, 98], [180, 80]],
        photos: ['Temple gate', 'Pool and glass wall'],
        later: true,
      },
      { name: 'Reserve River', kind: 'water', biome: 'aquatic', status: 'planned', points: [[20, 140], [200, 150], [196, 168], [20, 160]] },
      { name: 'Tapir Lagoon', species: "Baird's Tapir", biome: 'tropical', status: 'planned', color: '#4fb3a9', points: [[20, 170], [150, 176], [140, 228], [24, 226]] },
      { name: 'Treehouse Café', kind: 'facility', status: 'done', points: rect(220, 140, 54, 40) },
      { name: 'Red Panda hill', species: 'Red Panda', biome: 'temperate', status: 'idea', points: rect(286, 140, 60, 86) },
    ],
  });
  await createZoo(users.talyxel, {
    title: 'Desert Outpost (WIP)',
    description: 'Secret side project. Camels, meerkats and a canyon.',
    width: 240,
    height: 160,
    habitats: [
      { name: 'Camel Canyon', species: 'Dromedary Camel', biome: 'desert', status: 'planned', color: '#c79a3c', points: [[12, 12], [120, 16], [110, 90], [16, 80]] },
      { name: 'Oasis', kind: 'water', status: 'idea', points: [[150, 40], [200, 30], [220, 70], [170, 90]] },
    ],
  });

  // Milan: an aquarium with a reptile house.
  await createZoo(users.milan, {
    title: 'Blue Reef Aquarium & Reptiles',
    description: 'Small footprint, lots of glass. Exhibits only — trying to make a compact indoor zoo work.',
    width: 160,
    height: 120,
    publish: {},
    habitats: [
      { name: 'Reptile House', kind: 'exhibit', species: 'Komodo Dragon', biome: 'tropical', status: 'done', points: rect(10, 10, 70, 50), photos: ['Komodo enclosure'] },
      { name: 'Croc Lagoon', species: 'Saltwater Crocodile', biome: 'aquatic', status: 'building', color: '#4c98cc', points: [[90, 10], [150, 12], [148, 60], [92, 58]], photos: ['Lagoon edge'], later: true },
      { name: 'Entrance hall', kind: 'facility', status: 'done', points: rect(10, 74, 140, 36) },
    ],
  });

  // Lotte: a Planet Coaster theme park with themed lands.
  const thunderPeak = await createZoo(users.lotte, {
    parkType: 'theme_park',
    title: 'Thunder Peak Adventure Park',
    description: 'Three themed lands around one main street: pirates by the bay, a western mining town and a spooky hollow that is still mostly ideas.',
    width: 360,
    height: 260,
    publish: {
      survey: {
        question: 'Which coaster should Thunder Peak build next?',
        options: ['Launched coaster', 'Wing coaster over the bay', 'Family wild mouse'],
        allowSuggestions: true,
      },
    },
    habitats: [
      { name: 'Pirate Cove', kind: 'zone', biome: 'pirate', status: 'done', points: rect(10, 10, 166, 112), description: 'Docks, shipwrecks and a skull rock.' },
      { name: 'Frontier Town', kind: 'zone', biome: 'western', status: 'building', points: rect(184, 10, 166, 112), description: 'Mining town with a saloon and a big wooden coaster.' },
      { name: 'Spooky Hollow', kind: 'zone', biome: 'spooky', status: 'planned', points: rect(184, 140, 166, 110), description: 'Graveyard, crooked trees and fog machines.' },
      { name: 'Main Street', kind: 'path', status: 'done', points: rect(10, 124, 340, 12) },
      { name: 'Entrance Plaza', kind: 'path', status: 'done', points: rect(10, 140, 166, 110) },
      {
        name: 'Thunderbolt',
        kind: 'coaster',
        species: 'Wooden coaster',
        biome: 'western',
        status: 'done',
        description: 'Out-and-back wooden coaster through the mine buildings. Excitement 7.8, intensity 6.1.',
        points: [[196, 20], [340, 18], [338, 76], [280, 90], [200, 80]],
        photos: ['Lift hill at sunset', 'The first drop', 'Station building'],
      },
      { name: 'Rapids Run', kind: 'water_ride', species: 'River rapids', biome: 'western', status: 'planned', points: rect(196, 96, 144, 20) },
      { name: 'Galleon Swing', kind: 'ride', species: 'Pirate ship', biome: 'pirate', status: 'done', points: rect(126, 22, 40, 30), photos: ['Full swing'] },
      { name: 'Skull Bay', kind: 'water', status: 'done', points: [[20, 86], [104, 84], [112, 116], [22, 116]] },
      { name: 'Popcorn Stand', kind: 'shop', species: 'Food court', status: 'done', points: rect(24, 152, 34, 24) },
      { name: 'Gift Shop', kind: 'shop', species: 'Gift shop', status: 'done', points: rect(66, 152, 50, 24) },
      { name: 'First Aid & Restrooms', kind: 'facility', status: 'done', points: rect(124, 152, 40, 24) },
      {
        name: 'Kraken',
        kind: 'coaster',
        species: 'Inverted coaster',
        biome: 'pirate',
        status: 'building',
        description: 'Inverted coaster with a dive over Skull Bay. Supports still need hiding.',
        points: [[20, 20], [112, 18], [118, 74], [62, 80], [22, 66]],
        photos: ['Over the bay', 'Cobra roll'],
        later: true,
      },
      { name: 'Skywheel', kind: 'ride', species: 'Ferris wheel', biome: 'classic', status: 'done', points: rect(126, 64, 40, 40), photos: ['Skywheel at dusk'], later: true },
      { name: 'Nightmare Express', kind: 'coaster', species: 'Mine train', biome: 'spooky', status: 'idea', points: rect(250, 152, 88, 60), later: true },
    ],
  });
  const tpSurvey = (await users.lotte.call<ZooDetail>('GET', `/zoos/${thunderPeak}`)).surveys[0];
  await users.talyxel.call('POST', `/surveys/${tpSurvey.id}/vote`, { optionId: tpSurvey.options[1].id });
  await users.rosa.call('POST', `/surveys/${tpSurvey.id}/vote`, { optionId: tpSurvey.options[1].id });
  await users.kai.call('POST', `/surveys/${tpSurvey.id}/options`, { label: 'Bobsled through the hollow' });

  // Votes and a community suggestion on Rosa's survey.
  const rosaZoo = await users.rosa.call<ZooDetail>('GET', `/zoos/${serengeti}`);
  const survey = rosaZoo.surveys[0];
  await users.kai.call('POST', `/surveys/${survey.id}/vote`, { optionId: survey.options[0].id });
  await users.talyxel.call('POST', `/surveys/${survey.id}/vote`, { optionId: survey.options[2].id });
  await users.milan.call('POST', `/surveys/${survey.id}/options`, { label: 'Nile crocodile river' });

  // Spread timestamps over the last couple of weeks so the feed reads naturally.
  const events = all<{ id: number }>(db, 'SELECT id FROM events ORDER BY id DESC');
  let minutesAgo = 25;
  for (const e of events) {
    const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
    run(db, 'UPDATE events SET created_at = ? WHERE id = ?', at, e.id);
    minutesAgo += 40 + Math.round(Math.random() * 600);
  }
  run(
    db,
    `UPDATE zoos SET published_at = (SELECT MIN(created_at) FROM events WHERE events.zoo_id = zoos.id AND type = 'zoo_published')
     WHERE status = 'published'`,
  );
  run(db, 'UPDATE surveys SET created_at = (SELECT published_at FROM zoos WHERE zoos.id = surveys.zoo_id)');

  server.close();
  console.log(`Seeded ${people.length} builders. Log in as any of: ${people.map((p) => p.username).join(', ')} — password "${PASSWORD}"`);
}

main().catch((err) => {
  console.error(err);
  server.close();
  process.exit(1);
});
