import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleHelp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ParkType } from '../../../shared/constants';
import type { Survey } from '../../../shared/types';
import { api } from '../../api/client';
import { useMe } from '../../auth';
import { plural, timeAgo } from '../../lib/format';
import { useToast } from '../toast';

interface Props {
  survey: Survey;
  parkType: ParkType;
  /** Where to send people who need to log in first. */
  from: string;
}

/** A park's survey, votable right in the feed card. Tap your own choice again to take the vote back. */
export function FeedPoll({ survey: initial, parkType, from }: Props) {
  const { me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(initial);
  useEffect(() => setSurvey(initial), [initial]);

  const vote = useMutation({
    mutationFn: (optionId: number) => (survey.myVoteOptionId === optionId ? api.unvote(survey.id) : api.vote(survey.id, optionId)),
    onSuccess: (next) => {
      setSurvey(next);
      void qc.invalidateQueries({ queryKey: ['zoo', survey.zooId] });
    },
    onError: (err) => toast.error(err),
  });

  const total = survey.totalVotes;
  const canVote = survey.isOpen && !vote.isPending;
  return (
    <div className={`feed-poll${parkType === 'theme_park' ? ' is-coaster' : ''}${survey.isOpen ? '' : ' is-closed'}`}>
      <div className="feed-poll-head">
        <span className="feed-poll-question">
          <CircleHelp aria-hidden="true" />
          {survey.question}
        </span>
        <span className="feed-poll-meta">
          {plural(total, 'vote')} · {survey.isOpen ? timeAgo(survey.createdAt) : 'closed'}
        </span>
      </div>
      <div className="feed-poll-options" role="group" aria-label={survey.question}>
        {survey.options.map((o) => {
          const mine = survey.myVoteOptionId === o.id;
          const pct = survey.resultsVisible && total ? Math.round(((o.votes ?? 0) / total) * 100) : null;
          return (
            <button
              key={o.id}
              className={`feed-poll-option${mine ? ' is-mine' : ''}`}
              aria-pressed={mine}
              disabled={!canVote}
              title={survey.isOpen ? (mine ? 'Take back your vote' : 'Vote for this') : undefined}
              onClick={() => (me ? vote.mutate(o.id) : navigate('/login', { state: { from } }))}
            >
              {pct !== null && <span className="feed-poll-bar" style={{ width: `${pct}%` }} aria-hidden="true" />}
              <span className="feed-poll-radio" aria-hidden="true" />
              <span className="feed-poll-label">{o.label}</span>
              {pct !== null && <span className="feed-poll-pct">{pct}%</span>}
            </button>
          );
        })}
      </div>
      {me && survey.isOpen && !survey.resultsVisible && <p className="feed-poll-note">Vote to see the results.</p>}
    </div>
  );
}
