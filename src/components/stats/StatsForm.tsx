import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { ParkType } from '../../../shared/constants';
import { parkMeta } from '../../../shared/parks';
import { STAT_LIMITS, STAT_RANGE, statFields, type StatField } from '../../../shared/stats';
import type { ParkStats, StatsCustomRow, ZooDetail } from '../../../shared/types';
import { api, errorMessage } from '../../api/client';
import { useToast } from '../toast';
import { Modal } from '../ui';

const ADORN: Record<StatField['type'], { prefix?: string; suffix?: string; step: string }> = {
  int: { step: '1' },
  decimal: { step: '0.1' },
  percent: { suffix: '%', step: '0.1' },
  rating: { suffix: '★', step: '0.5' },
  money: { prefix: '$', step: '1' },
};

interface Props {
  zooId: number;
  parkType: ParkType;
  stats: ParkStats | null;
  onClose: () => void;
  onSaved?: (stats: ParkStats) => void;
}

/** Form for the in-game numbers a builder copies from Planet Zoo / Planet Coaster. */
export function StatsForm({ zooId, parkType, stats, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const fields = statFields(parkType);
  const meta = parkMeta(parkType);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, stats?.values[f.key] !== undefined ? String(stats.values[f.key]) : ''])),
  );
  const [custom, setCustom] = useState<StatsCustomRow[]>(() => stats?.custom ?? []);
  const [gameDate, setGameDate] = useState(stats?.gameDate ?? '');
  const [localError, setLocalError] = useState('');

  const save = useMutation({
    mutationFn: (body: Parameters<typeof api.saveStats>[1]) => api.saveStats(zooId, body),
    onSuccess: (saved) => {
      qc.setQueryData<ZooDetail>(['zoo', zooId], (z) => (z ? { ...z, stats: saved } : z));
      void qc.invalidateQueries({ queryKey: ['zoos'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
      onSaved?.(saved);
      toast.ok('Stats saved');
      onClose();
    },
  });

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    setLocalError('');
    const parsed: Record<string, number | null> = {};
    for (const f of fields) {
      const raw = values[f.key].trim().replace(/,/g, '');
      if (!raw) {
        parsed[f.key] = null;
        continue;
      }
      const n = Number(raw);
      const range = STAT_RANGE[f.type];
      if (!Number.isFinite(n)) return setLocalError(`${f.label} must be a number`);
      if (range.integer && !Number.isInteger(n)) return setLocalError(`${f.label} must be a whole number`);
      if (n < range.min || n > range.max) return setLocalError(`${f.label} must be between ${range.min.toLocaleString('en')} and ${range.max.toLocaleString('en')}`);
      parsed[f.key] = n;
    }
    const rows = custom.map((r) => ({ label: r.label.trim(), value: r.value.trim() })).filter((r) => r.label || r.value);
    if (rows.some((r) => !r.label || !r.value)) return setLocalError('Give every extra stat a name and a value');
    save.mutate({ values: parsed, custom: rows, gameDate: gameDate.trim() });
  };

  const groups = [...new Set(fields.map((f) => f.group))];
  const error = localError || (save.error ? errorMessage(save.error) : '');

  return (
    <Modal
      title="Park statistics"
      description={`Copy the numbers from ${meta.game}. Leave out anything you don't track — saving again on another day shows what changed.`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => submit()} disabled={save.isPending}>
            Save stats
          </button>
        </>
      }
    >
      <form className="stats-form" onSubmit={submit}>
        {error && <div className="form-error">{error}</div>}
        <label className="field">
          <span>In-game date</span>
          <input
            className="input"
            value={gameDate}
            maxLength={STAT_LIMITS.gameDate}
            placeholder="e.g. Year 3, March"
            onChange={(e) => setGameDate(e.target.value)}
          />
        </label>
        {groups.map((group) => (
          <fieldset key={group} className="stats-group">
            <legend>{group}</legend>
            <div className="stats-grid">
              {fields
                .filter((f) => f.group === group)
                .map((f) => {
                  const adorn = ADORN[f.type];
                  const range = STAT_RANGE[f.type];
                  const id = `stat-${f.key}`;
                  return (
                    <div key={f.key} className="field">
                      <label htmlFor={id}>{f.label}</label>
                      <span className="input-adorned">
                        {adorn.prefix && <span className="adorn">{adorn.prefix}</span>}
                        <input
                          id={id}
                          aria-describedby={f.hint ? `${id}-hint` : undefined}
                          className="input"
                          type="number"
                          inputMode="decimal"
                          step={adorn.step}
                          min={range.min}
                          max={range.max}
                          value={values[f.key]}
                          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        />
                        {adorn.suffix && <span className="adorn">{adorn.suffix}</span>}
                      </span>
                      {f.hint && <small id={`${id}-hint`}>{f.hint}</small>}
                    </div>
                  );
                })}
            </div>
          </fieldset>
        ))}
        <fieldset className="stats-group">
          <legend>Anything else</legend>
          {custom.length > 0 && (
            <div className="stats-custom">
              {custom.map((row, i) => (
                <div key={i} className="row">
                  <input
                    className="input"
                    aria-label={`Extra stat ${i + 1} name`}
                    placeholder="Name, e.g. Gift shop income"
                    maxLength={STAT_LIMITS.customText}
                    value={row.label}
                    onChange={(e) => setCustom((c) => c.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                  />
                  <input
                    className="input"
                    aria-label={`Extra stat ${i + 1} value`}
                    placeholder="Value, e.g. $3,400 a month"
                    maxLength={STAT_LIMITS.customText}
                    value={row.value}
                    onChange={(e) => setCustom((c) => c.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={`Remove extra stat ${i + 1}`}
                    onClick={() => setCustom((c) => c.filter((_, j) => j !== i))}
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
          )}
          {custom.length < STAT_LIMITS.customRows && (
            <button type="button" className="btn btn-sm" onClick={() => setCustom((c) => [...c, { label: '', value: '' }])}>
              <Plus /> Add a stat
            </button>
          )}
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
