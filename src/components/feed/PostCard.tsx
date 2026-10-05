import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, Ellipsis, Heart, Map as MapIcon, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { KIND_META, POST_LIMITS } from '../../../shared/constants';
import { parkMeta } from '../../../shared/parks';
import type { Comment, FeedItem } from '../../../shared/types';
import { api, ApiError } from '../../api/client';
import { useMe } from '../../auth';
import { plural, timeAgo } from '../../lib/format';
import { useToast } from '../toast';
import { Avatar, Modal, UserLink } from '../ui';
import { FeedPoll } from './FeedPoll';
import { PostMedia } from './PostMedia';

/** A post's first line becomes its title when it's short enough to read as one. */
const TITLE_MAX = 90;

/** Splits a post into a title (a short first line, or a short post as a whole) and the rest. */
export function splitPost(body: string): { title: string; text: string } {
  const text = body.trim();
  const [first, ...rest] = text.split('\n');
  if (rest.length && first.trim().length <= TITLE_MAX) return { title: first.trim(), text: rest.join('\n').trim() };
  if (text.length <= TITLE_MAX) return { title: text, text: '' };
  return { title: '', text };
}

/** What the media frame shows: the post's or shape's photos, or else the park map. */
function mediaFor(item: FeedItem) {
  const photos = item.post ? item.post.photos : item.type === 'habitat_added' ? [] : item.photos;
  const highlight = item.habitat ? { points: item.habitat.points, kind: item.habitat.kind } : undefined;
  const place = item.zoo ? (item.habitat ? `${item.habitat.name} · ${item.zoo.title}` : item.zoo.title) : undefined;
  const placeTo = item.zoo ? (item.habitat ? `/z/${item.zoo.id}?h=${item.habitat.id}` : `/z/${item.zoo.id}`) : undefined;
  return { photos, highlight, place, placeTo };
}

/** What happened, as the card's title and text, for park activity (posts use their own words). */
function activityText(item: FeedItem): { title: ReactNode; text: string } {
  const zoo = item.zoo;
  const shape = item.habitat && (
    <Link to={`/z/${zoo?.id}?h=${item.habitat.id}`} className="strong-link">
      {item.habitat.name}
    </Link>
  );
  const park = zoo && (
    <Link to={`/z/${zoo.id}`} className="strong-link">
      {zoo.title}
    </Link>
  );
  switch (item.type) {
    case 'zoo_published':
      return { title: <>Published a new {zoo ? parkMeta(zoo.parkType).noun : 'park'} plan: {park}</>, text: zoo?.description ?? '' };
    case 'habitat_added':
      return {
        title: (
          <>
            Added {KIND_META[item.habitat?.kind ?? 'habitat'].label.toLowerCase()} {shape}
            {item.habitat?.species && <span className="species-inline"> ({item.habitat.species})</span>} to {park}
          </>
        ),
        text: item.habitat?.description ?? '',
      };
    case 'photos_added':
      return {
        title: (
          <>
            Added {plural(item.photos.length, 'photo')} to {shape} in {park}
          </>
        ),
        text: '',
      };
    case 'survey_created':
      return { title: <>Wants your opinion on {park}</>, text: '' };
    default:
      return { title: null, text: '' };
  }
}

/** Title and text above the media. Long text clamps to a few lines with a "more" toggle. */
function PostText({ item }: { item: FeedItem }) {
  const [open, setOpen] = useState(false);
  const { title, text } = item.post ? splitPost(item.post.body) : activityText(item);
  const long = text.length > 280 || text.split('\n').length > 4;
  if (!title && !text) return null;
  return (
    <div className="post-text">
      {title && <h2 className={`post-title${item.post ? '' : ' is-activity'}`}>{title}</h2>}
      {text && (
        <p className={`post-body${long && !open ? ' clamped' : ''}`}>
          {text}
          {long && !open && (
            <button className="link-button" onClick={() => setOpen(true)}>
              more
            </button>
          )}
        </p>
      )}
    </div>
  );
}

function CommentLine({ comment, onDelete }: { comment: Comment; onDelete?: () => void }) {
  return (
    <div className="comment">
      <Link to={`/u/${comment.author.username}`} className="comment-avatar" aria-hidden="true" tabIndex={-1}>
        <Avatar user={comment.author} size={28} />
      </Link>
      <div className="comment-bubble">
        <span className="comment-head">
          <UserLink user={comment.author} />
          <span className="comment-time">{timeAgo(comment.createdAt)}</span>
        </span>
        <p className="comment-body">{comment.body}</p>
      </div>
      {onDelete && comment.canDelete && (
        <button className="btn btn-ghost btn-icon btn-sm comment-delete" aria-label="Delete comment" onClick={onDelete}>
          <X />
        </button>
      )}
    </div>
  );
}

interface Props {
  item: FeedItem;
  /** On a post's own page: every comment, delete buttons, comment box focused. */
  full?: boolean;
  onDeleted?: () => void;
}

/** One post: author, title and text, photos or the park map, a survey, likes, comments and a comment box. */
export function PostCard({ item, full = false, onDeleted }: Props) {
  const { me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [like, setLike] = useState({ likes: item.likes, liked: item.liked });
  const [comments, setComments] = useState(item.comments);
  const [commentCount, setCommentCount] = useState(item.commentCount);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A refetch brings fresh numbers.
  useEffect(() => {
    setLike({ likes: item.likes, liked: item.liked });
    setComments(item.comments);
    setCommentCount(item.commentCount);
  }, [item]);

  const needLogin = () => {
    navigate('/login', { state: { from: `/p/${item.id}` } });
  };

  const likeMutation = useMutation({
    mutationFn: (on: boolean) => (on ? api.like(item.id) : api.unlike(item.id)),
    onMutate: (on) => setLike((l) => ({ liked: on, likes: Math.max(0, l.likes + (on === l.liked ? 0 : on ? 1 : -1)) })),
    onSuccess: (state) => setLike(state),
    onError: (err) => {
      setLike({ likes: item.likes, liked: item.liked });
      if (err instanceof ApiError && err.status === 401) needLogin();
      else toast.error(err);
    },
  });
  const setLiked = (on: boolean) => {
    if (!me) return needLogin();
    if (on !== like.liked) likeMutation.mutate(on);
  };

  const commentMutation = useMutation({
    mutationFn: (body: string) => api.addComment(item.id, body),
    onSuccess: (c) => {
      setComments((list) => [...list, c]);
      setCommentCount((n) => n + 1);
      setDraft('');
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (err) => toast.error(err),
  });
  const submitComment = (e: FormEvent) => {
    e.preventDefault();
    if (!me) return needLogin();
    if (draft.trim()) commentMutation.mutate(draft.trim());
  };

  const removeComment = async (c: Comment) => {
    try {
      await api.deleteComment(c.id);
      setComments((list) => list.filter((x) => x.id !== c.id));
      setCommentCount((n) => Math.max(0, n - 1));
    } catch (err) {
      toast.error(err);
    }
  };

  const deletePost = async () => {
    try {
      await api.deleteActivity(item.id);
      toast.ok('Post deleted');
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: ['posts'] });
      void qc.invalidateQueries({ queryKey: ['profile'] });
      onDeleted?.();
    } catch (err) {
      toast.error(err);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/p/${item.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.ok('Link copied');
    } catch {
      toast.ok(url);
    }
  };

  const media = mediaFor(item);
  const isQuestion = item.post?.kind === 'question';
  const shownComments = full ? comments : comments.slice(-3);
  const noun = isQuestion ? 'answer' : 'comment';

  return (
    <article className={`post-card card${isQuestion ? ' is-question' : ''}`} aria-label={`Post by ${item.actor.displayName}`}>
      <header className="post-head">
        <Link to={`/u/${item.actor.username}`} className="post-avatar" aria-hidden="true" tabIndex={-1}>
          <Avatar user={item.actor} size={40} />
        </Link>
        <div className="spacer post-who">
          <UserLink user={item.actor} />
          <span className="post-meta">
            @{item.actor.username} ·{' '}
            <Link to={`/p/${item.id}`} className="post-time">
              <time dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
            </Link>
            {isQuestion && (
              <span className="post-kind">
                <CircleHelp aria-hidden="true" /> Question
              </span>
            )}
          </span>
        </div>
        {item.canDelete && (
          <div className="post-menu">
            <button className="icon-action" aria-label="Post options" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <Ellipsis />
            </button>
            {menuOpen && (
              <div className="menu card" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                <button
                  role="menuitem"
                  className="menu-item danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2 /> Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <PostText item={item} />
      <PostMedia {...media} zoo={item.zoo} onDoubleTap={() => setLiked(true)} label={`Pictures from ${item.actor.displayName}`} />
      {item.survey && item.zoo && <FeedPoll survey={item.survey} parkType={item.zoo.parkType} from={`/p/${item.id}`} />}

      <div className="post-actions">
        <button
          className={`icon-action like${like.liked ? ' on' : ''}`}
          aria-pressed={like.liked}
          aria-label={like.liked ? 'Unlike' : 'Like'}
          onClick={() => setLiked(!like.liked)}
        >
          <Heart />
        </button>
        <span className="post-count post-likes" title={plural(like.likes, 'like')}>
          {like.likes}
          <span className="sr-only"> {like.likes === 1 ? 'like' : 'likes'}</span>
        </span>
        <button className="icon-action" aria-label={isQuestion ? 'Answer' : 'Comment'} onClick={() => (me ? inputRef.current?.focus() : needLogin())}>
          <MessageCircle />
        </button>
        <span className="post-count">{plural(commentCount, noun)}</span>
        <button className="icon-action" aria-label="Copy link" title="Copy link" onClick={copyLink}>
          <Send />
        </button>
        <span className="spacer" />
        {item.zoo && (
          <Link to={`/z/${item.zoo.id}`} className="icon-action" aria-label="Open park" title="Open park">
            <MapIcon />
          </Link>
        )}
      </div>

      {!full && commentCount > shownComments.length && (
        <Link to={`/p/${item.id}`} className="post-more-comments">
          View all {plural(commentCount, noun)}
        </Link>
      )}
      {shownComments.length > 0 && (
        <div className="post-comments">
          {shownComments.map((c) => (
            <CommentLine key={c.id} comment={c} onDelete={full ? () => void removeComment(c) : undefined} />
          ))}
        </div>
      )}
      {full && comments.length === 0 && <p className="subtle">{isQuestion ? 'No answers yet — be the first.' : 'No comments yet.'}</p>}

      {me ? (
        <form className="comment-form" onSubmit={submitComment}>
          <Avatar user={me} size={28} />
          <input
            ref={inputRef}
            className="comment-input"
            value={draft}
            maxLength={POST_LIMITS.comment}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isQuestion ? `Answer ${item.actor.displayName}…` : 'Add a comment…'}
            aria-label={isQuestion ? 'Your answer' : 'Your comment'}
            autoFocus={full}
          />
          <button className="link-button strong" disabled={!draft.trim() || commentMutation.isPending}>
            Post
          </button>
        </form>
      ) : (
        <div className="comment-form">
          <Link to="/login" state={{ from: `/p/${item.id}` }} className="subtle">
            Log in to like and comment
          </Link>
        </div>
      )}

      {confirmDelete && (
        <Modal
          title="Delete this post?"
          description="Its photos, likes and comments are removed too. This can't be undone."
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirmDelete(false);
                  void deletePost();
                }}
              >
                <Trash2 /> Delete post
              </button>
            </>
          }
        >
          <p className="muted">It disappears from your profile and your followers' feeds.</p>
        </Modal>
      )}
    </article>
  );
}
