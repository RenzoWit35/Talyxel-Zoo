import { Router } from 'express';
import { z } from 'zod';
import type { Onboarding } from '../../shared/types';
import { one, run, type DB } from '../db';
import { parse, requireUser } from '../http';

const dismissInput = z.object({ dismissed: z.boolean() });

/** The getting-started checklist: each step is worked out from what the builder has actually done. */
export function onboardingRoutes(db: DB) {
  const r = Router();

  const load = (userId: number): Onboarding => {
    const row = one<Record<string, number | string | null>>(
      db,
      `SELECT
         EXISTS (SELECT 1 FROM zoos WHERE owner_id = $u) AS park,
         EXISTS (SELECT 1 FROM habitats h JOIN zoos z ON z.id = h.zoo_id WHERE z.owner_id = $u) AS shape,
         EXISTS (SELECT 1 FROM habitats h JOIN zoos z ON z.id = h.zoo_id
                 WHERE z.owner_id = $u AND h.kind IN ('utility', 'route', 'interest')) AS mapDetails,
         EXISTS (SELECT 1 FROM zoo_stats s JOIN zoos z ON z.id = s.zoo_id WHERE z.owner_id = $u) AS stats,
         EXISTS (SELECT 1 FROM zoos WHERE owner_id = $u AND status = 'published') AS publish,
         EXISTS (SELECT 1 FROM follows WHERE follower_id = $u) AS follow,
         EXISTS (SELECT 1 FROM posts WHERE user_id = $u) AS post,
         (SELECT bio <> '' FROM users WHERE id = $u) AS profile,
         (SELECT onboarding_dismissed_at FROM users WHERE id = $u) AS dismissed,
         (SELECT id FROM zoos WHERE owner_id = $u ORDER BY updated_at DESC LIMIT 1) AS parkId`,
      { u: userId } as never,
    )!;
    return {
      steps: {
        park: !!row.park,
        shape: !!row.shape,
        mapDetails: !!row.mapDetails,
        stats: !!row.stats,
        publish: !!row.publish,
        follow: !!row.follow,
        post: !!row.post,
        profile: !!row.profile,
      },
      dismissed: !!row.dismissed,
      parkId: (row.parkId as number | null) ?? null,
    };
  };

  r.get('/', (req, res) => {
    res.json(load(requireUser(req).id));
  });

  r.put('/', (req, res) => {
    const me = requireUser(req);
    const { dismissed } = parse(dismissInput, req.body);
    run(
      db,
      `UPDATE users SET onboarding_dismissed_at = ${dismissed ? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')" : 'NULL'} WHERE id = ?`,
      me.id,
    );
    res.json(load(me.id));
  });

  return r;
}
