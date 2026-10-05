import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { LIMITS } from '../../shared/constants';
import { api, errorMessage, type SurveyDraft } from '../api/client';
import { useToast } from './toast';
import { Modal } from './ui';

export function emptySurvey(title: string, ideas: string[] = []): SurveyDraft {
  const options = ideas.slice(0, LIMITS.surveyOwnerOptionsMax);
  while (options.length < 2) options.push('');
  return { question: `What should I add to ${title} next?`.slice(0, 200), options, allowSuggestions: true };
}

/** Returns an error message, or null when the survey can be submitted. */
export function surveyProblem(s: SurveyDraft): string | null {
  if (s.question.trim().length < 3) return 'Write a question first.';
  const opts = s.options.map((o) => o.trim()).filter(Boolean);
  if (opts.length < 2) return 'Add at least two options.';
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return 'Two options are the same.';
  return null;
}

export const cleanSurvey = (s: SurveyDraft): SurveyDraft => ({
  question: s.question.trim(),
  options: s.options.map((o) => o.trim()).filter(Boolean),
  allowSuggestions: s.allowSuggestions,
});

export function SurveyEditor({
  value,
  onChange,
  examples = ['e.g. Red Panda habitat', 'e.g. Reptile house'],
}: {
  value: SurveyDraft;
  onChange: (s: SurveyDraft) => void;
  /** Placeholders for the first two options. */
  examples?: readonly [string, string];
}) {
  const setOption = (i: number, text: string) => onChange({ ...value, options: value.options.map((o, j) => (j === i ? text : o)) });
  return (
    <div className="survey-editor stack">
      <label className="field">
        <span>Question</span>
        <input className="input" value={value.question} maxLength={200} onChange={(e) => onChange({ ...value, question: e.target.value })} />
      </label>
      <div className="field">
        <span>Options</span>
        {value.options.map((o, i) => (
          <div key={i} className="row">
            <span className="survey-editor-bullet">{i + 1}</span>
            <input
              className="input"
              value={o}
              maxLength={80}
              placeholder={examples[i] ?? 'Another idea'}
              onChange={(e) => setOption(i, e.target.value)}
            />
            {value.options.length > 2 && (
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Remove option"
                onClick={() => onChange({ ...value, options: value.options.filter((_, j) => j !== i) })}
              >
                <X />
              </button>
            )}
          </div>
        ))}
        {value.options.length < LIMITS.surveyOwnerOptionsMax && (
          <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ ...value, options: [...value.options, ''] })}>
            <Plus /> Add option
          </button>
        )}
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={value.allowSuggestions} onChange={(e) => onChange({ ...value, allowSuggestions: e.target.checked })} />
        <span>
          <strong>Let visitors suggest their own ideas</strong>
          <br />
          <span className="subtle">Suggestions are added as new options that everyone can vote on.</span>
        </span>
      </label>
    </div>
  );
}

/** Start another survey on an already-published park. */
export function NewSurveyDialog({
  zooId,
  title,
  ideas,
  examples,
  onClose,
}: {
  zooId: number;
  title: string;
  ideas?: string[];
  examples?: readonly [string, string];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [survey, setSurvey] = useState(() => emptySurvey(title, ideas));
  const problem = surveyProblem(survey);
  const create = useMutation({
    mutationFn: () => api.createSurvey(zooId, cleanSurvey(survey)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['zoo', zooId] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
      toast.ok('Survey started — your followers will see it in their feed');
      onClose();
    },
  });
  return (
    <Modal
      title="Ask the community"
      description="Start a new survey about what to add next. It shows up on your park page and in your followers' feeds."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-accent" disabled={!!problem || create.isPending} onClick={() => create.mutate()} title={problem ?? undefined}>
            Start survey
          </button>
        </>
      }
    >
      {create.error && <div className="form-error">{errorMessage(create.error)}</div>}
      <SurveyEditor value={survey} onChange={setSurvey} examples={examples} />
    </Modal>
  );
}
