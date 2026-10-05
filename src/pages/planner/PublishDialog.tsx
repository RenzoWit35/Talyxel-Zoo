import { Check, Copy, ExternalLink, Globe, Vote } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { ZooDetail } from '../../../shared/types';
import { errorMessage } from '../../api/client';
import { cleanSurvey, emptySurvey, SurveyEditor, surveyProblem } from '../../components/SurveyEditor';
import { Modal } from '../../components/ui';
import type { ZooEditor } from './useZooEditor';

export function PublishDialog({ editor, onClose }: { editor: ZooEditor; onClose: () => void }) {
  const zoo: ZooDetail = editor.zoo;
  const ideas = zoo.habitats.filter((h) => h.status === 'idea').map((h) => (h.species ? `${h.name} (${h.species})` : h.name).slice(0, 80));
  const [withSurvey, setWithSurvey] = useState(true);
  const [survey, setSurvey] = useState(() => emptySurvey(zoo.title, ideas));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const problem = withSurvey ? surveyProblem(survey) : null;
  const url = `${window.location.origin}/z/${zoo.id}`;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await editor.publish(withSurvey ? cleanSurvey(survey) : undefined);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal title="Your zoo is live! 🎉" description="It's on your profile and in your followers' feeds now." onClose={onClose}
        footer={
          <>
            <button className="btn" onClick={onClose}>
              Keep planning
            </button>
            <Link to={`/z/${zoo.id}`} className="btn btn-primary">
              <ExternalLink /> View public page
            </Link>
          </>
        }
      >
        <div className="share-box">
          <Globe />
          <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
          <button
            className="btn"
            onClick={() => {
              void navigator.clipboard?.writeText(url).then(() => setCopied(true));
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        {withSurvey && (
          <p className="muted">
            <Vote size={15} style={{ verticalAlign: '-2px' }} /> Your survey is open. Close it from the zoo page whenever you've decided.
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      title={`Publish “${zoo.title}”`}
      description="Publishing makes the plan visible to everyone, adds it to your profile and announces it in your followers' feeds. You can keep editing afterwards."
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" onClick={submit} disabled={busy || !!problem} title={problem ?? undefined}>
            <Globe /> {withSurvey ? 'Publish with survey' : 'Publish'}
          </button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}
      {zoo.habitats.length === 0 && <div className="form-error">Your map is still empty — you can publish anyway, but there won't be much to see.</div>}
      <label className="checkbox publish-toggle">
        <input type="checkbox" checked={withSurvey} onChange={(e) => setWithSurvey(e.target.checked)} />
        <span>
          <strong>Ask what I should add next</strong>
          <br />
          <span className="subtle">Attach a survey so visitors and friends can vote on your next build.</span>
        </span>
      </label>
      {withSurvey && (
        <>
          {ideas.length > 0 && <p className="subtle">We pre-filled the options with the shapes you marked as “Idea”.</p>}
          <SurveyEditor value={survey} onChange={setSurvey} />
        </>
      )}
      {problem && <p className="subtle">{problem}</p>}
    </Modal>
  );
}
