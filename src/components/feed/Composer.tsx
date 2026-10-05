import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, ImagePlus, Megaphone, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { LIMITS, POST_LIMITS } from '../../../shared/constants';
import type { PostKind } from '../../../shared/types';
import { api, errorMessage } from '../../api/client';
import { useMe } from '../../auth';
import { useToast } from '../toast';
import { Avatar } from '../ui';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

const COPY: Record<PostKind, { placeholder: string; button: string }> = {
  update: { placeholder: 'What did you build today? A short first line becomes the title — add screenshots below.', button: 'Share update' },
  question: { placeholder: 'Ask your followers — e.g. “Which coaster should go next to the lake?”', button: 'Ask question' },
};

/** The "Share an update" box at the top of the Social feed; posting or closing it calls onClose. */
export function Composer({ onClose }: { onClose: () => void }) {
  const { me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<PostKind>('update');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [zooId, setZooId] = useState<number | ''>('');
  const [error, setError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const parks = useQuery({ queryKey: ['zoos', 'mine'], queryFn: api.myZoos });
  const published = (parks.data ?? []).filter((z) => z.status === 'published');

  // Focus the text as soon as the box opens, however it was opened.
  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);


  const create = useMutation({
    mutationFn: api.createPost,
    onSuccess: () => {
      toast.ok(kind === 'question' ? 'Question posted' : 'Update posted');
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: ['posts'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['onboarding'] });
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const addFiles = (list: FileList | null) => {
    const picked = [...(list ?? [])].filter((f) => ACCEPT.includes(f.type));
    if (picked.some((f) => f.size > LIMITS.uploadBytes)) return setError('Images can be at most 8 MB each');
    const next = [...files, ...picked].slice(0, POST_LIMITS.photos);
    if (files.length + picked.length > POST_LIMITS.photos) setError(`A post can have at most ${POST_LIMITS.photos} photos`);
    else setError('');
    setFiles(next);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if (kind === 'question' && text.length < 3) return setError('Ask your question in at least 3 characters');
    if (kind === 'update' && !text && !files.length) return setError('Write something or add a photo');
    create.mutate({ kind, body: text, zooId: zooId || null, photos: files });
  };

  if (!me) return null;

  return (
    <form className="composer card" onSubmit={submit} aria-label="New post" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="composer-top">
        <Avatar user={me} size={40} />
        <div className="segmented" role="radiogroup" aria-label="Post type">
          <button type="button" role="radio" aria-checked={kind === 'update'} aria-pressed={kind === 'update'} onClick={() => setKind('update')}>
            <Megaphone /> Update
          </button>
          <button type="button" role="radio" aria-checked={kind === 'question'} aria-pressed={kind === 'question'} onClick={() => setKind('question')}>
            <CircleHelp /> Question
          </button>
        </div>
        <span className="spacer" />
        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Close" onClick={onClose}>
          <X />
        </button>
      </div>
      {error && <div className="form-error">{error}</div>}
      <textarea
        ref={textRef}
        className="textarea composer-text"
        aria-label={kind === 'question' ? 'Your question' : 'Your update'}
        placeholder={COPY[kind].placeholder}
        value={body}
        maxLength={POST_LIMITS.body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && submit()}
      />
      {files.length > 0 && (
        <div className="composer-photos">
          {previews.map((url, i) => (
            <div key={url} className="composer-photo">
              <img src={url} alt="" />
              <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}>
                <X />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="composer-bar">
        {files.length < POST_LIMITS.photos && (
          <label className="btn btn-sm">
            <ImagePlus /> Add photos
            <input
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
        <select
          className="select select-sm composer-park"
          aria-label="Link a park"
          value={zooId}
          onChange={(e) => setZooId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">No park linked</option>
          {published.map((z) => (
            <option key={z.id} value={z.id}>
              {z.title}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <span className="subtle composer-count">{POST_LIMITS.body - body.length}</span>
        <button className="btn btn-primary btn-sm" disabled={create.isPending}>
          {COPY[kind].button}
        </button>
      </div>
    </form>
  );
}
