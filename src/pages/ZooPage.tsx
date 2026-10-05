import { useQuery } from '@tanstack/react-query';
import { Calendar, Footprints, Images, Lock, PenLine, Plus, Ruler, Vote, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { BIOME_LABELS, HABITAT_STATUSES, KIND_META, STATUS_META, type HabitatKind } from '../../shared/constants';
import { parkMeta } from '../../shared/parks';
import { formatArea, formatLength, polygonArea, polylineLength } from '../../shared/geometry';
import type { Habitat, ZooDetail } from '../../shared/types';
import { api, ApiError, errorMessage } from '../api/client';
import { FollowButton } from '../components/FollowButton';
import { KindIcon } from '../components/KindIcon';
import { ParkIcon } from '../components/ParkType';
import { PhotoGrid } from '../components/Lightbox';
import { StatusChip } from '../components/map/HoverCard';
import { LayerToggles } from '../components/map/LayerToggles';
import { MapCanvas } from '../components/map/MapCanvas';
import { SurveyCard } from '../components/SurveyCard';
import { StatsForm } from '../components/stats/StatsForm';
import { StatsView } from '../components/stats/StatsView';
import { NewSurveyDialog } from '../components/SurveyEditor';
import { Avatar, PageLoader } from '../components/ui';
import { shade } from '../lib/color';
import { formatDate, plural } from '../lib/format';
import { shapeFacts, shapeSize } from '../lib/shapes';
import { NotFound } from './NotFound';

function HabitatDetails({ habitat, onClose }: { habitat: Habitat; onClose: () => void }) {
  return (
    <div className="habitat-details card">
      <div className="habitat-details-head" style={{ background: `linear-gradient(135deg, ${shade(habitat.color, 0.15)}, ${shade(habitat.color, -0.25)})` }}>
        <div className="spacer">
          <span className="habitat-details-kind">{KIND_META[habitat.kind].label}</span>
          <h2>{habitat.name}</h2>
          {habitat.species && <span className="habitat-details-species">{habitat.species}</span>}
        </div>
        <button className="btn btn-icon btn-sm" onClick={onClose} aria-label="Close details">
          <X />
        </button>
      </div>
      <div className="habitat-details-body">
        <div className="row row-wrap" style={{ gap: 6 }}>
          <StatusChip status={habitat.status} />
          {habitat.biome && <span className="chip">{BIOME_LABELS[habitat.biome]}</span>}
        </div>
        <div className="stat-row">
          {shapeFacts(habitat).map((f) => (
            <div key={f.label}>
              <small>{f.label}</small>
              <strong>{f.value}</strong>
            </div>
          ))}
          <div>
            <small>Photos</small>
            <strong>{habitat.photos.length}</strong>
          </div>
        </div>
        {habitat.description && <p className="habitat-details-desc">{habitat.description}</p>}
        {habitat.photos.length > 0 ? (
          <PhotoGrid photos={habitat.photos} title={habitat.name} max={12} />
        ) : (
          <p className="subtle">No photos of this one yet.</p>
        )}
      </div>
    </div>
  );
}

function ZooView({ zoo }: { zoo: ZooDetail }) {
  const meta = parkMeta(zoo.parkType);
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const [newSurvey, setNewSurvey] = useState(false);
  const [hiddenKinds, setHiddenKinds] = useState<Set<HabitatKind>>(() => new Set());
  const [statsOpen, setStatsOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const surveysRef = useRef<HTMLDivElement>(null);
  const selectedId = Number(params.get('h')) || null;
  const selected = zoo.habitats.find((h) => h.id === selectedId) ?? null;
  const select = (id: number | null) => setParams(id ? { h: String(id) } : {}, { replace: true, preventScrollReset: true });

  useEffect(() => {
    if (hash === '#surveys') surveysRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const counts = useMemo(() => {
    const animals = zoo.habitats.filter((h) => meta.featureKinds.includes(h.kind));
    return {
      animals: animals.length,
      area: animals.reduce((s, h) => s + polygonArea(h.points), 0),
      species: new Set(animals.map((h) => h.species.trim()).filter(Boolean)).size,
      photos: zoo.habitats.reduce((s, h) => s + h.photos.length, 0),
      routes: zoo.habitats.filter((h) => h.kind === 'route').reduce((s, h) => s + polylineLength(h.points), 0),
    };
  }, [zoo.habitats, meta]);

  const listed = [...zoo.habitats]
    .filter((h) => h.kind !== 'path')
    .sort((a, b) => HABITAT_STATUSES.indexOf(b.status) - HABITAT_STATUSES.indexOf(a.status) || b.photos.length - a.photos.length);

  return (
    <div className="page zoo-page">
      <header className="zoo-head">
        <div className="spacer">
          <div className="row row-wrap" style={{ gap: 8, marginBottom: 8 }}>
            {zoo.status === 'draft' && (
              <span className="chip">
                <Lock /> Draft — only you can see this
              </span>
            )}
            {zoo.surveys.some((s) => s.isOpen) && (
              <button className="chip chip-accent chip-button" onClick={() => surveysRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                <Vote /> Survey open — have your say
              </button>
            )}
          </div>
          <h1>{zoo.title}</h1>
          {zoo.description && <p className="zoo-desc">{zoo.description}</p>}
          <div className="zoo-facts">
            <span>
              <Ruler /> {zoo.width} × {zoo.height} m
            </span>
            <span>
              <ParkIcon type={zoo.parkType} size={15} /> {meta.game}
            </span>
            <span>{plural(counts.animals, ...meta.featureNoun)}</span>
            <span>
              {formatArea(counts.area)} {meta.featureAreaLabel}
            </span>
            <span>{plural(counts.species, ...meta.subjectNoun)}</span>
            {counts.routes > 0 && (
              <span>
                <Footprints /> {formatLength(counts.routes)} of walk routes
              </span>
            )}
            <span>
              <Images /> {counts.photos}
            </span>
            {zoo.publishedAt && (
              <span>
                <Calendar /> {formatDate(zoo.publishedAt)}
              </span>
            )}
          </div>
        </div>
        <div className="zoo-owner card">
          <Link to={`/u/${zoo.owner.username}`} className="row" style={{ gap: 10, color: 'inherit' }}>
            <Avatar user={zoo.owner} size={44} />
            <div>
              <strong>{zoo.owner.displayName}</strong>
              <div className="subtle">@{zoo.owner.username}</div>
            </div>
          </Link>
          {zoo.isOwner ? (
            <Link to={`/zoos/${zoo.id}/edit`} className="btn btn-primary btn-sm">
              <PenLine /> Edit plan
            </Link>
          ) : (
            <OwnerFollow username={zoo.owner.username} />
          )}
        </div>
      </header>

      <div className="zoo-map-wrap card" ref={mapRef}>
        <MapCanvas
          width={zoo.width}
          height={zoo.height}
          habitats={zoo.habitats}
          background={zoo.backgroundUrl ? { url: zoo.backgroundUrl, opacity: zoo.backgroundOpacity } : null}
          selectedId={selectedId}
          hiddenKinds={hiddenKinds}
          onSelect={(id) => select(id)}
        />
        {selected && <HabitatDetails key={selected.id} habitat={selected} onClose={() => select(null)} />}
        <div className="map-legend">
          {HABITAT_STATUSES.map((s) => (
            <span key={s}>
              <i className={`legend-swatch status-${s}`} style={{ ['--c' as string]: STATUS_META[s].color }} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
      </div>
      <LayerToggles kinds={meta.kinds} habitats={zoo.habitats} hidden={hiddenKinds} onChange={setHiddenKinds} variant="chips" />
      <p className="subtle map-tip">Hover (or tap) a shape for photos and info · click to open it · scroll or pinch to zoom · drag to pan</p>

      <StatsView stats={zoo.stats} parkType={zoo.parkType} isOwner={zoo.isOwner} onEdit={() => setStatsOpen(true)} />

      <div className="zoo-columns">
        <section>
          <h2 className="section-title">In this {meta.noun}</h2>
          {listed.length ? (
            <div className="habitat-grid">
              {listed.map((h) => (
                <button
                  key={h.id}
                  className={`habitat-tile card${h.id === selectedId ? ' selected' : ''}`}
                  onClick={() => {
                    select(h.id);
                    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <div className="habitat-tile-img" style={{ background: `linear-gradient(135deg, ${shade(h.color, 0.2)}, ${shade(h.color, -0.25)})` }}>
                    {h.photos[0] ? <img src={h.photos[0].url} alt="" loading="lazy" /> : <KindIcon kind={h.kind} />}
                    {h.photos.length > 1 && (
                      <span className="chip">
                        <Images /> {h.photos.length}
                      </span>
                    )}
                  </div>
                  <div className="habitat-tile-body">
                    <strong>{h.name}</strong>
                    {h.species && <span className="species">{h.species}</span>}
                    <div className="row row-wrap" style={{ gap: 5 }}>
                      <StatusChip status={h.status} />
                      <span className="subtle">{shapeSize(h)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Nothing drawn yet.</p>
          )}
        </section>

        <section ref={surveysRef} id="surveys" className="zoo-surveys">
          <div className="row" style={{ marginBottom: 14 }}>
            <h2 className="section-title spacer" style={{ margin: 0 }}>
              Surveys
            </h2>
            {zoo.isOwner && zoo.status === 'published' && (
              <button className="btn btn-sm" onClick={() => setNewSurvey(true)}>
                <Plus /> New survey
              </button>
            )}
          </div>
          {zoo.surveys.length ? (
            <div className="stack" style={{ gap: 14 }}>
              {zoo.surveys.map((s) => (
                <SurveyCard key={s.id} survey={s} zooId={zoo.id} isOwner={zoo.isOwner} />
              ))}
            </div>
          ) : (
            <div className="card card-pad muted">
              {zoo.isOwner
                ? zoo.status === 'published'
                  ? 'Ask your followers what to build next with a survey.'
                  : 'Publish this zoo from the planner to start a survey.'
                : `${zoo.owner.displayName} hasn't asked for input yet.`}
            </div>
          )}
        </section>
      </div>
      {statsOpen && <StatsForm zooId={zoo.id} parkType={zoo.parkType} stats={zoo.stats} onClose={() => setStatsOpen(false)} />}
      {newSurvey && (
        <NewSurveyDialog
          zooId={zoo.id}
          title={zoo.title}
          ideas={zoo.habitats.filter((h) => h.status === 'idea').map((h) => h.name)}
          examples={meta.optionExamples}
          onClose={() => setNewSurvey(false)}
        />
      )}
    </div>
  );
}

function OwnerFollow({ username }: { username: string }) {
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => api.profile(username) });
  if (!profile.data) return null;
  return <FollowButton username={username} isFollowing={profile.data.isFollowing} followsYou={profile.data.followsYou} size="sm" />;
}

export function ZooPage() {
  const { id } = useParams();
  const zooId = Number(id);
  const query = useQuery({ queryKey: ['zoo', zooId], queryFn: () => api.zoo(zooId), enabled: Number.isInteger(zooId) });
  if (!Number.isInteger(zooId)) return <NotFound what="park" />;
  if (query.isPending) return <PageLoader />;
  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFound what="park" />;
    return <div className="page">{errorMessage(query.error)}</div>;
  }
  return <ZooView zoo={query.data} />;
}
