import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Lock, LockOpen, Plus, Trash2, Vote, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { LIMITS } from '../../shared/constants';
import type { Survey, ZooDetail } from '../../shared/types';
import { api } from '../api/client';
import { useMe } from '../auth';
import { plural, timeAgo } from '../lib/format';
import { useToast } from './toast';

interface Props {
  survey: Survey;
  zooId: number;
  isOwner: boolean;
}

export function SurveyCard({ survey, zooId, isOwner }: Props) {
  const { me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [suggestion, setSuggestion] = useState('');

  // Every survey endpoint returns the updated survey; patch it into the cached zoo.
  const replace = (next: Survey) =>
    qc.setQueryData<ZooDetail>(['zoo', zooId], (z) => (z ? { ...z, surveys: z.surveys.map((s) => (s.id === next.id ? next : s)) } : z));

  const mutate = useMutation({
    mutationFn: (fn: () => Promise<Survey | { ok: true }>) => fn(),
    onSuccess: (result) => {
      if ('id' in result) replace(result);
      else void qc.invalidateQueries({ queryKey: ['zoo', zooId] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (err) => toast.error(err),
  });

  const total = survey.totalVotes;
  const canVote = !!me && survey.isOpen;
  const leader = survey.resultsVisible ? Math.max(0, ...survey.options.map((o) => o.votes ?? 0)) : 0;
  const optionsFull = survey.options.length >= LIMITS.surveyOptionsMax;

  const suggest = (e: FormEvent) => {
    e.preventDefault();
    const label = suggestion.trim();
    if (!label) return;
    mutate.mutate(() => api.suggest(survey.id, label), { onSuccess: () => setSuggestion('') });
  };

  return (
    <div className={`survey card${survey.isOpen ? '' : ' closed'}`}>
      <div className="survey-head">
        <span className="survey-icon">
          <Vote />
        </span>
        <div className="spacer">
          <h3>{survey.question}</h3>
          <span className="subtle">
            {plural(total, 'vote')} · {survey.isOpen ? `started ${timeAgo(survey.createdAt)}` : 'closed'}
          </span>
        </div>
        {isOwner && (
          <div className="row" style={{ gap: 2 }}>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              title={survey.isOpen ? 'Close survey' : 'Reopen survey'}
              aria-label={survey.isOpen ? 'Close survey' : 'Reopen survey'}
              onClick={() => mutate.mutate(() => api.setSurveyOpen(survey.id, !survey.isOpen))}
            >
              {survey.isOpen ? <Lock /> : <LockOpen />}
            </button>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              title="Delete survey"
              aria-label="Delete survey"
              onClick={() => confirm('Delete this survey and all its votes?') && mutate.mutate(() => api.deleteSurvey(survey.id))}
            >
              <Trash2 />
            </button>
          </div>
        )}
      </div>

      <div className="survey-options">
        {survey.options.map((o) => {
          const mine = survey.myVoteOptionId === o.id;
          const pct = survey.resultsVisible && total ? Math.round(((o.votes ?? 0) / total) * 100) : 0;
          const winning = survey.resultsVisible && !!o.votes && o.votes === leader;
          return (
            <div key={o.id} className="survey-option-row">
              <button
                className={`survey-option${mine ? ' mine' : ''}${winning ? ' winning' : ''}${survey.resultsVisible ? ' results' : ''}`}
                disabled={!canVote || mutate.isPending}
                onClick={() => mutate.mutate(() => (mine ? api.unvote(survey.id) : api.vote(survey.id, o.id)))}
                title={canVote ? (mine ? 'Click to take back your vote' : 'Vote for this') : undefined}
              >
                {survey.resultsVisible && <span className="survey-bar" style={{ width: `${pct}%` }} />}
                <span className="survey-option-label">
                  {mine && <Check size={15} />}
                  <span>
                    {o.label}
                    {o.suggestedBy && <small className="survey-suggested">suggested by @{o.suggestedBy.username}</small>}
                  </span>
                </span>
                {survey.resultsVisible && (
                  <span className="survey-pct">
                    {pct}% <small>({o.votes})</small>
                  </span>
                )}
              </button>
              {isOwner && survey.options.length > LIMITS.surveyOptionsMin && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label={`Remove option ${o.label}`}
                  title="Remove option"
                  onClick={() => mutate.mutate(() => api.deleteOption(survey.id, o.id))}
                >
                  <X />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!me && survey.isOpen && (
        <p className="subtle">
          <Link to="/login">Log in</Link> to vote{survey.allowSuggestions ? ' or suggest your own idea' : ''}.
        </p>
      )}
      {me && survey.isOpen && !survey.resultsVisible && <p className="subtle">Vote to see the results.</p>}
      {me && survey.isOpen && (survey.allowSuggestions || isOwner) && !optionsFull && (
        <form className="survey-suggest" onSubmit={suggest}>
          <input
            className="input"
            placeholder={isOwner ? 'Add another option' : 'Suggest something else…'}
            value={suggestion}
            maxLength={80}
            onChange={(e) => setSuggestion(e.target.value)}
          />
          <button className="btn btn-sm" disabled={!suggestion.trim() || mutate.isPending}>
            <Plus /> {isOwner ? 'Add' : 'Suggest'}
          </button>
        </form>
      )}
    </div>
  );
}
