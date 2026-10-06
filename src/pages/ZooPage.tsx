import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, Footprints, Images, Leaf, Lightbulb, Lock, MousePointer2, PenLine, Plus, Route, Ruler, Scan, Star, Vote, X } from 'lucide-react';
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
import { Lightbox } from '../components/Lightbox';
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
import { shapeSize } from '../lib/shapes';
import { NotFound } from './NotFound';

/** The selected area, floating over the map: photos, what you see and why it's built this way. */
function HabitatDetails({ habitat, coaster, onClose }: { habitat: Habitat; coaster: boolean; onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const photos = habitat.photos;
  const shown = photos.slice(0, 3);
  return (
    <section className={`habitat-details card${coaster ? ' is-coaster' : ''}`} aria-labelledby="habitat-details-title">
      <div className="habitat-details-top">
        <span className={`chip ${coaster ? 'chip-pink' : 'chip-mint'}`}>
          <KindIcon kind={habitat.kind} /> {KIND_META[habitat.kind].label}
        </span>
        <span className="spacer" />
        <button className="habitat-details-close" onClick={onClose} aria-label="Close details" title="Close">
          <X />
        </button>
      </div>
      <div>
        <h2 id="habitat-details-title">{habitat.name}</h2>
        {habitat.species && <span className="habitat-details-species">{habitat.species}</span>}
      </div>
      {shown.length > 0 && (
        <div className={`details-photos n${shown.length}`}>
          {shown.map((p, i) => (
            <button key={p.id} onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`}>
              <img src={p.url} alt={p.caption} loading="lazy" />
              {i === shown.length - 1 && photos.length > shown.length && <span className="photo-more">+{photos.length - shown.length}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="row row-wrap" style={{ gap: 6 }}>
        <StatusChip status={habitat.status} />
        <span className="chip">{shapeSize(habitat)}</span>
        {habitat.biome && <span className="chip">{BIOME_LABELS[habitat.biome]}</span>}
      </div>
      {habitat.description && (
        <div className="details-text">
          <span className="details-label">What you see here</span>
          <p>{habitat.description}</p>
        </div>
      )}
      {habitat.reason && (
        <div className="details-why">
          <span>
            <Lightbulb /> Why it’s built this way
          </span>
          <p>{habitat.reason}</p>
        </div>
      )}
      {!habitat.description && !habitat.reason && !photos.length && <p className="subtle">No photos or notes for this one yet.</p>}
      {photos.length > 0 && (
        <button className="details-more" onClick={() => setOpen(0)}>
          {photos.length === 1 ? 'View the photo' : `View all ${photos.length} photos`} <ArrowRight />
        </button>
      )}
      {open !== null && <Lightbox photos={photos} start={open} title={habitat.name} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** The in-game rating from the builder's latest stats: stars for zoos, a percentage for theme parks. */
function RatingCard({ zoo }: { zoo: ZooDetail }) {
  const rating = zoo.stats?.values.rating;
  if (rating === undefined || rating === null) return null;
  const isStars = zoo.parkType === 'zoo';
  const stars = isStars ? Math.round(rating) : Math.round(rating / 20);
  return (
    <section className="card zoo-rating" aria-label={isStars ? 'Zoo rating' : 'Park rating'}>
      <div className="zoo-rating-value">
        <strong>{isStars ? rating.toLocaleString('en', { maximumFractionDigits: 1 }) : `${Math.round(rating)}%`}</strong>
        {isStars && <span>/ 5</span>}
      </div>
      <div className="zoo-rating-stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={n <= stars ? 'on' : ''} />
        ))}
      </div>
      <p>
        {isStars ? 'Zoo rating' : 'Park rating'} in the game{zoo.stats?.gameDate ? ` · ${zoo.stats.gameDate}` : ''}
      </p>
    </section>
  );
}

function ZooView({ zoo }: { zoo: ZooDetail }) {
  const meta = parkMeta(zoo.parkType);
  const coaster = zoo.parkType === 'theme_park';
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
    <div className={`page zoo-page${coaster ? ' is-coaster' : ''}`}>
      <header className="zoo-head">
        <div className="zoo-head-text">
          <div className="row row-wrap" style={{ gap: 8 }}>
            <span className={`chip ${coaster ? 'chip-pink' : 'chip-mint'}`}>
              <ParkIcon type={zoo.parkType} size={12} /> {meta.noun}
            </span>
            {zoo.status === 'draft' && (
              <span className="chip">
                <Lock /> Draft — only you can see this
              </span>
            )}
            {zoo.surveys.some((s) => s.isOpen) && (
              <button className="chip chip-cream chip-button" onClick={() => surveysRef.current?.scrollIntoView({ behavior: 'smooth' })}>
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
        <div className="zoo-owner">
          <Link to={`/u/${zoo.owner.username}`} className="zoo-owner-who">
            <Avatar user={zoo.owner} size={44} />
            <span>
              <small>Designed by</small>
              <strong>{zoo.owner.displayName}</strong>
            </span>
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

      <div className="zoo-map-wrap" ref={mapRef}>
        <MapCanvas
          width={zoo.width}
          height={zoo.height}
          habitats={zoo.habitats}
          background={zoo.backgroundUrl ? { url: zoo.backgroundUrl, opacity: zoo.backgroundOpacity } : null}
          selectedId={selectedId}
          hiddenKinds={hiddenKinds}
          onSelect={(id) => select(id)}
        />
        {!selected && (
          <span className="map-hint">
            <MousePointer2 /> Point at an area for its story
          </span>
        )}
        {selected && <HabitatDetails key={selected.id} habitat={selected} coaster={coaster} onClose={() => select(null)} />}
        <div className="map-layers">
          <LayerToggles kinds={meta.kinds} habitats={zoo.habitats} hidden={hiddenKinds} onChange={setHiddenKinds} variant="chips" />
        </div>
      </div>
      <div className="map-under">
        <div className="map-legend">
          {HABITAT_STATUSES.map((s) => (
            <span key={s}>
              <i className={`legend-swatch status-${s}`} style={{ ['--c' as string]: STATUS_META[s].color }} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
        <p className="subtle map-tip">Click an area to open it · scroll or pinch to zoom · drag to pan</p>
      </div>

      <div className="zoo-summary">
        <section className="card zoo-numbers" aria-labelledby="zoo-numbers-title">
          <h2 id="zoo-numbers-title">{coaster ? 'Park' : 'Zoo'} in numbers</h2>
          <div>
            <span>
              <i>
                <Scan />
              </i>
              <span>
                <strong>{formatArea(counts.area)}</strong>
                <small>{meta.featureAreaLabel}</small>
              </span>
            </span>
            <span>
              <i>
                <KindIcon kind={meta.defaultKind} />
              </i>
              <span>
                <strong>{plural(counts.species, ...meta.subjectNoun)}</strong>
                <small>in the {meta.noun}</small>
              </span>
            </span>
            <span>
              <i>{counts.routes > 0 ? <Route /> : <Footprints />}</i>
              <span>
                <strong>{counts.routes > 0 ? formatLength(counts.routes) : plural(counts.animals, ...meta.featureNoun)}</strong>
                <small>{counts.routes > 0 ? 'of walk routes' : 'planned so far'}</small>
              </span>
            </span>
          </div>
        </section>
        {zoo.principle && (
          <section className="zoo-principle" aria-label="Design principle">
            <i>
              <Leaf />
            </i>
            <div>
              <small>Design principle</small>
              <blockquote>“{zoo.principle}”</blockquote>
            </div>
          </section>
        )}
        <RatingCard zoo={zoo} />
      </div>

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
  return <FollowButton username={username} isFollowing={profile.data.isFollowing} followsYou={profile.data.followsYou} size="sm" plain />;
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
