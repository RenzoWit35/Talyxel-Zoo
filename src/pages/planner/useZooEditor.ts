import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KIND_META, type HabitatKind, type HabitatStatus, type ParkType } from '../../../shared/constants';
import type { Point } from '../../../shared/geometry';
import type { Habitat, ZooDetail } from '../../../shared/types';
import { api, ApiError, type HabitatInput, type SurveyDraft } from '../../api/client';
import { useToast } from '../../components/toast';

type ZooPatch = Partial<Pick<ZooDetail, 'title' | 'description' | 'backgroundOpacity'>>;
export type SaveState = 'saved' | 'saving' | 'error';

const SAVE_DELAY = 600;
const UNDO_LIMIT = 50;

const isRetryable = (err: unknown) => !(err instanceof ApiError) || err.status === 0 || err.status >= 500;

/**
 * Local editing state for one park plan. Edits apply instantly on screen and are
 * saved to the server in the background (debounced), with an undo stack for geometry.
 */
export function useZooEditor(initial: ZooDetail) {
  const qc = useQueryClient();
  const toast = useToast();
  const [zoo, setZoo] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [canUndo, setCanUndo] = useState(false);

  const zooRef = useRef(zoo);
  zooRef.current = zoo;
  const inflight = useRef(0);
  const pendingHabitats = useRef(new Map<number, HabitatInput>());
  const pendingZoo = useRef<ZooPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoStack = useRef<{ id: number; points: Point[] }[]>([]);

  const hasPending = () => pendingHabitats.current.size > 0 || Object.keys(pendingZoo.current).length > 0;

  const settle = useCallback(() => {
    if (inflight.current === 0 && !hasPending()) setSaveState((s) => (s === 'saving' ? 'saved' : s));
  }, []);

  /** Wrap a server call so the save indicator and error toasts stay accurate. */
  const track = useCallback(
    async <T>(promise: Promise<T>): Promise<T> => {
      inflight.current++;
      setSaveState('saving');
      try {
        const result = await promise;
        inflight.current--;
        setSaveState(inflight.current === 0 && !hasPending() ? 'saved' : 'saving');
        return result;
      } catch (err) {
        inflight.current--;
        setSaveState('error');
        toast.error(err);
        throw err;
      }
    },
    [toast],
  );

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const habitatPatches = [...pendingHabitats.current.entries()];
    const zooPatch = pendingZoo.current;
    pendingHabitats.current = new Map();
    pendingZoo.current = {};
    const id = zooRef.current.id;
    const jobs: Promise<unknown>[] = habitatPatches.map(([hid, patch]) =>
      track(api.updateHabitat(hid, patch)).catch((err) => {
        if (isRetryable(err)) pendingHabitats.current.set(hid, { ...patch, ...pendingHabitats.current.get(hid) });
      }),
    );
    if (Object.keys(zooPatch).length) {
      jobs.push(
        track(api.updateZoo(id, zooPatch)).catch((err) => {
          if (isRetryable(err)) pendingZoo.current = { ...zooPatch, ...pendingZoo.current };
        }),
      );
    }
    await Promise.all(jobs);
    settle();
  }, [track, settle]);

  const schedule = useCallback(() => {
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY);
  }, [flush]);

  const patchLocalHabitat = (id: number, patch: Partial<Habitat>) =>
    setZoo((z) => ({ ...z, habitats: z.habitats.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));

  const updateHabitat = useCallback(
    (id: number, patch: HabitatInput, opts: { immediate?: boolean; undoable?: boolean } = {}) => {
      const current = zooRef.current.habitats.find((h) => h.id === id);
      if (!current) return;
      if (patch.points && opts.undoable !== false) {
        undoStack.current = [...undoStack.current.slice(-UNDO_LIMIT + 1), { id, points: current.points }];
        setCanUndo(true);
      }
      patchLocalHabitat(id, patch);
      pendingHabitats.current.set(id, { ...pendingHabitats.current.get(id), ...patch });
      if (opts.immediate) void flush();
      else schedule();
    },
    [flush, schedule],
  );

  const undo = useCallback(() => {
    const last = undoStack.current.pop();
    setCanUndo(undoStack.current.length > 0);
    if (last) updateHabitat(last.id, { points: last.points }, { immediate: true, undoable: false });
    return last?.id ?? null;
  }, [updateHabitat]);

  const createHabitat = useCallback(
    async (points: Point[], kind: HabitatKind, extra: { name?: string; status?: HabitatStatus } = {}) => {
      const n = zooRef.current.habitats.filter((h) => h.kind === kind).length + 1;
      const name = extra.name || `${KIND_META[kind].noun} ${n}`;
      const habitat = await track(api.createHabitat(zooRef.current.id, { points, kind, name, status: extra.status }));
      setZoo((z) => ({ ...z, habitats: [...z.habitats, habitat] }));
      return habitat;
    },
    [track],
  );

  const deleteHabitat = useCallback(
    async (id: number) => {
      pendingHabitats.current.delete(id);
      await track(api.deleteHabitat(id));
      undoStack.current = undoStack.current.filter((u) => u.id !== id);
      setCanUndo(undoStack.current.length > 0);
      setZoo((z) => ({ ...z, habitats: z.habitats.filter((h) => h.id !== id) }));
    },
    [track],
  );

  /** Photo endpoints return the whole habitat; only take its photos so unsaved field edits survive. */
  const applyPhotos = (h: Habitat) => patchLocalHabitat(h.id, { photos: h.photos });

  const uploadPhotos = useCallback(async (id: number, files: File[]) => applyPhotos(await track(api.uploadPhotos(id, files))), [track]);
  const addPhotoUrl = useCallback(async (id: number, url: string) => applyPhotos(await track(api.addPhotoUrl(id, url))), [track]);
  const deletePhoto = useCallback(async (photoId: number) => applyPhotos(await track(api.deletePhoto(photoId))), [track]);
  const updatePhotoCaption = useCallback(async (photoId: number, caption: string) => applyPhotos(await track(api.updatePhoto(photoId, caption))), [track]);

  const updateZoo = useCallback(
    (patch: ZooPatch, opts: { immediate?: boolean } = {}) => {
      setZoo((z) => ({ ...z, ...patch }));
      pendingZoo.current = { ...pendingZoo.current, ...patch };
      if (opts.immediate) void flush();
      else schedule();
    },
    [flush, schedule],
  );

  /** Server-confirmed changes to the park itself (type, size, background, publishing) — keep local shape edits. */
  const applyZoo = (z: ZooDetail) => setZoo((prev) => ({ ...z, title: prev.title, description: prev.description, habitats: prev.habitats }));

  /** Switching type clears biomes/themes that don't exist in the new type, so take the server's shapes. */
  const setParkType = useCallback(
    async (parkType: ParkType) => {
      await flush();
      const z = await track(api.updateZoo(zooRef.current.id, { parkType }));
      setZoo((prev) => ({ ...z, title: prev.title, description: prev.description }));
    },
    [flush, track],
  );

  const resize = useCallback(async (width: number, height: number) => applyZoo(await track(api.updateZoo(zooRef.current.id, { width, height }))), [track]);
  const setBackground = useCallback(async (file: File) => applyZoo(await track(api.setBackground(zooRef.current.id, file))), [track]);
  const removeBackground = useCallback(async () => applyZoo(await track(api.removeBackground(zooRef.current.id))), [track]);

  const publish = useCallback(
    async (survey?: SurveyDraft) => {
      await flush();
      applyZoo(await track(api.publish(zooRef.current.id, survey)));
    },
    [flush, track],
  );
  const unpublish = useCallback(async () => applyZoo(await track(api.unpublish(zooRef.current.id))), [track]);

  const saveBoard = useCallback(
    async (columns: Record<HabitatStatus, number[]>) => {
      setZoo((z) => ({
        ...z,
        habitats: z.habitats.map((h) => {
          for (const [status, ids] of Object.entries(columns) as [HabitatStatus, number[]][]) {
            const position = ids.indexOf(h.id);
            if (position >= 0) return { ...h, status, position };
          }
          return h;
        }),
      }));
      await flush();
      await track(api.saveBoard(zooRef.current.id, columns));
    },
    [flush, track],
  );

  // Save what's left and refresh cached lists when leaving the planner.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (hasPending() || inflight.current > 0) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      void flush().finally(() => {
        void qc.invalidateQueries({ queryKey: ['zoo', zooRef.current.id] });
        void qc.invalidateQueries({ queryKey: ['zoos'] });
        void qc.invalidateQueries({ queryKey: ['profile'] });
        void qc.invalidateQueries({ queryKey: ['feed'] });
      });
    };
  }, [flush, qc]);

  return {
    zoo,
    saveState,
    canUndo,
    flush,
    undo,
    updateHabitat,
    createHabitat,
    deleteHabitat,
    uploadPhotos,
    addPhotoUrl,
    deletePhoto,
    updatePhotoCaption,
    updateZoo,
    resize,
    setParkType,
    setBackground,
    removeBackground,
    publish,
    unpublish,
    saveBoard,
  };
}

export type ZooEditor = ReturnType<typeof useZooEditor>;
