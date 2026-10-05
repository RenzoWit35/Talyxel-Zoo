import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Map, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LIMITS } from '../../shared/constants';
import { api, errorMessage } from '../api/client';
import { EmptyState, Modal, PageLoader } from '../components/ui';
import { ZooCard } from '../components/ZooCard';

const SIZES = [
  { label: 'Small', width: 200, height: 150 },
  { label: 'Medium', width: 400, height: 300 },
  { label: 'Large', width: 800, height: 600 },
  { label: 'Huge', width: 1500, height: 1000 },
];

function NewZooDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(300);
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
    create.mutate({ title, description, width, height });
  };
  return (
    <Modal
      title="New zoo plan"
      description="You can change all of this later in the planner."
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
        <label className="field">
          <span>Name</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Talyxel Wildlife Park" required />
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
          <small>Match your Planet Zoo map so areas come out right. You can trace over a screenshot later.</small>
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
          <h1>My zoos</h1>
          <p>Your planning boards. Drafts are private until you publish them.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus /> New zoo plan
        </button>
      </div>
      {zoos.isPending ? (
        <PageLoader />
      ) : !zoos.data?.length ? (
        <div className="card">
          <EmptyState
            icon={<Map />}
            title="Plan your first zoo"
            action={
              <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                <Plus /> New zoo plan
              </button>
            }
          >
            Start with an empty map, draw your habitats from above and fill them with photos and notes.
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
