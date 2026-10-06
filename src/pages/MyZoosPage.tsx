import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Map, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LIMITS, STANDARD_MAP, type ParkType } from '../../shared/constants';
import { parkMeta } from '../../shared/parks';
import { api, errorMessage } from '../api/client';
import { ParkTypePicker } from '../components/ParkType';
import { EmptyState, Modal, PageLoader } from '../components/ui';
import { ZooCard } from '../components/ZooCard';
import { loadPlanner } from '../App';

const SIZES = [
  { label: 'Small', width: 500, height: 495 },
  { label: 'Standard', width: STANDARD_MAP.width, height: STANDARD_MAP.height },
  { label: 'Large', width: 1500, height: 1485 },
  { label: 'Huge', width: 2000, height: 1980 },
];

function NewZooDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  // Fetch the planner's code while the form is being filled in, so "Create" opens it straight away.
  useEffect(() => {
    void loadPlanner();
  }, []);
  const qc = useQueryClient();
  const [parkType, setParkType] = useState<ParkType>('zoo');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [width, setWidth] = useState<number>(STANDARD_MAP.width);
  const [height, setHeight] = useState<number>(STANDARD_MAP.height);
  const create = useMutation({
    mutationFn: api.createZoo,
    onSuccess: (zoo) => {
      qc.setQueryData(['zoo', zoo.id], zoo);
      void qc.invalidateQueries({ queryKey: ['zoos'] });
      navigate(`/zoos/${zoo.id}/edit`);
    },
  });
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    create.mutate({ parkType, title, description, width, height });
  };
  return (
    <Modal
      title="New plan"
      description="Pick what you're building — you can change the rest later in the planner."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => submit()} disabled={!title.trim() || create.isPending}>
            Create & open planner
          </button>
        </>
      }
    >
      <form className="stack" onSubmit={submit} style={{ gap: 16 }}>
        {create.error && <div className="form-error">{errorMessage(create.error)}</div>}
        <ParkTypePicker value={parkType} onChange={setParkType} />
        <label className="field">
          <span>Name</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={parkMeta(parkType).namePlaceholder} required />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Theme, map, goals… (optional)"
          />
        </label>
        <div className="field">
          <span>Map size (metres)</span>
          <div className="segmented full">
            {SIZES.map((s) => (
              <button
                type="button"
                key={s.label}
                aria-pressed={width === s.width && height === s.height}
                onClick={() => {
                  setWidth(s.width);
                  setHeight(s.height);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="row">
            <input
              className="input"
              type="number"
              min={LIMITS.mapMin}
              max={LIMITS.mapMax}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              aria-label="Width in metres"
            />
            <span className="muted">×</span>
            <input
              className="input"
              type="number"
              min={LIMITS.mapMin}
              max={LIMITS.mapMax}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              aria-label="Height in metres"
            />
          </div>
          <small>
            Standard is {STANDARD_MAP.width.toLocaleString('en')} × {STANDARD_MAP.height} m. Match your {parkMeta(parkType).game} map so areas come out right; you can
            trace over a screenshot later.
          </small>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function MyZoosPage() {
  const [params, setParams] = useSearchParams();
  const zoos = useQuery({ queryKey: ['zoos', 'mine'], queryFn: api.myZoos });
  const showNew = params.get('new') === '1';
  const setShowNew = (show: boolean) => setParams(show ? { new: '1' } : {}, { replace: true });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="lp-pill">Your planning board</span>
          <h1>My parks</h1>
          <p>Your zoo and theme park plans. Drafts are private until you publish them.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus /> New plan
        </button>
      </div>
      {zoos.isPending ? (
        <PageLoader />
      ) : !zoos.data?.length ? (
        <div className="card">
          <EmptyState
            icon={<Map />}
            title="Plan your first park"
            action={
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                <Plus /> New plan
              </button>
            }
          >
            Pick a zoo or a theme park, draw your habitats or rides from above and fill them with photos and notes.
          </EmptyState>
        </div>
      ) : (
        <div className="grid-cards">
          {zoos.data.map((z) => (
            <ZooCard key={z.id} zoo={z} editable showOwner={false} />
          ))}
        </div>
      )}
      {showNew && <NewZooDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
