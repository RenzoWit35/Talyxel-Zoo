import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Map as MapIcon, MessageCircle, MessageCircleQuestion, MoreHorizontal, Send, Trash2, Vote, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { KIND_META, POST_LIMITS } from '../../../shared/constants';
import { parkMeta } from '../../../shared/parks';
import type { Comment, FeedItem } from '../../../shared/types';
import { api, ApiError } from '../../api/client';
import { useMe } from '../../auth';
import { plural, timeAgo } from '../../lib/format';
import { ParkIcon } from '../ParkType';
import { useToast } from '../toast';
import { Avatar, Modal, UserLink } from '../ui';
import { MediaCarousel, type Slide } from './MediaCarousel';

/** Text-only posts up to this length become a big text card; longer ones are just a caption. */
const TEXT_CARD_MAX = 220;

function slidesFor(item: FeedItem): Slide[] {
  const map: Slide | null = item.zoo
    ? { type: 'map', zoo: item.zoo, highlight: item.habitat ? { points: item.habitat.points, kind: item.habitat.kind } : undefined }
    : null;
  const photos: Slide[] = item.photos.map((photo) => ({ type: 'photo', photo }));
  switch (item.type) {
    case 'post_created': {
      const p = item.post!;
      const slides: Slide[] = p.photos.map((photo) => ({ type: 'photo', photo }));
      if (map) slides.push(map);
      if (!slides.length && p.body && p.body.length <= TEXT_CARD_MAX) slides.push({ type: 'text', text: p.body, tone: p.kind });
      return slides;
    }
    case 'habitat_added':
      return [...(map ? [map] : []), ...photos];
    case 'photos_added':
      return [...photos, ...(map ? [map] : [])];
    default:
      return map ? [map] : [];
  }
}

/** What happened, in words, for park activity (posts use their own text). */
function activityText(item: FeedItem): ReactNode {
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
      return (
        <>
          published a new {zoo ? parkMeta(zoo.parkType).noun : 'park'} plan: {park}
          {zoo?.description && <span className="post-desc">{zoo.description}</span>}
        </>
      );
    case 'habitat_added':
      return (
        <>
          added {KIND_META[item.habitat?.kind ?? 'habitat'].label.toLowerCase()} {shape}
          {item.habitat?.species && <em className="species-inline"> · {item.habitat.species}</em>} to {park}
          {item.habitat?.description && <span className="post-desc">{item.habitat.description}</span>}
        </>
      );
    case 'photos_added':
      return (
        <>
          added {plural(item.photos.length, 'photo')} to {shape} in {park}
        </>
      );
    case 'survey_created':
      return <>wants your opinion on {park}</>;
    default:
      return null;
  }
}

function SurveyCallout({ item }: { item: FeedItem }) {
  if (!item.survey || !item.zoo) return null;
  return (
    <Link to={`/z/${item.zoo.id}#surveys`} className="feed-survey">
      <Vote />
      <div className="spacer">
        <strong>{item.survey.question}</strong>
        <span className="subtle">
          {plural(item.survey.optionCount, 'option')} · {plural(item.survey.totalVotes, 'vote')}
          {!item.survey.isOpen && ' · closed'}
        </span>
      </div>
      {item.survey.isOpen && <span className="btn btn-sm btn-accent">Vote</span>}
    </Link>
  );
}

/** Caption that clamps long text to a few lines with a "more" toggle. */
function Caption({ item, showBody }: { item: FeedItem; showBody: boolean }) {
  const [open, setOpen] = useState(false);
  const body = item.post ? (showBody ? item.post.body : '') : null;
  const long = (body?.length ?? 0) > 160 || (body?.split('\n').length ?? 0) > 3;
  if (item.post && !body) return null;
  return (
    <p className={`post-caption${long && !open ? ' clamped' : ''}`}>
      <UserLink user={item.actor}>
        <strong>{item.actor.displayName}</strong>
      </UserLink>{' '}
      {item.post ? <span className="post-body">{body}</span> : activityText(item)}
      {long && !open && (
        <button className="link-button" onClick={() => setOpen(true)}>
          more
        </button>
      )}
    </p>
  );
}

function CommentLine({ comment, onDelete }: { comment: Comment; onDelete?: () => void }) {
  return (
    <div className="comment">
      <Link to={`/u/${comment.author.username}`} className="comment-avatar" aria-hidden="true" tabIndex={-1}>
        <Avatar user={comment.author} size={26} />
      </Link>
      <p className="spacer">
        <UserLink user={comment.author}>
          <strong>{comment.author.displayName}</strong>
        </UserLink>{' '}
        <span className="post-body">{comment.body}</span>
        <span className="comment-time"> · {timeAgo(comment.createdAt)}</span>
      </p>
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

/** One Instagram-style card: header, square media, actions, likes, caption, comments and a comment box. */
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

  const slides = slidesFor(item);
  const textCard = slides.length === 1 && slides[0].type === 'text';
  const isQuestion = item.post?.kind === 'question';
  // Our own like may not be in the server's list yet (or may have just been taken back).
  const likers = [
    ...(like.liked && me && !item.likedBy.some((u) => u.id === me.id) ? [me] : []),
    ...item.likedBy.filter((u) => like.liked || u.id !== me?.id),
  ].slice(0, 3);
  const firstLiker = likers.find((u) => u.id !== me?.id) ?? likers[0];
  const shownComments = full ? comments : comments.slice(-3);

  return (
    <article className={`post-card card${isQuestion ? ' is-question' : ''}`} aria-label={`Post by ${item.actor.displayName}`}>
      <header className="post-head">
        <Link to={`/u/${item.actor.username}`} className="post-avatar" aria-hidden="true" tabIndex={-1}>
          <Avatar user={item.actor} size={36} />
        </Link>
        <div className="spacer post-who">
          <div className="post-who-line">
            <UserLink user={item.actor}>
              <strong>{item.actor.displayName}</strong>
            </UserLink>
            <span className="subtle">
              {' '}
              ·{' '}
              <Link to={`/p/${item.id}`} className="post-time">
                <time dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
              </Link>
            </span>
          </div>
          {item.zoo ? (
            <Link to={`/z/${item.zoo.id}`} className="post-place">
              <ParkIcon type={item.zoo.parkType} size={12} /> {item.zoo.title}
            </Link>
          ) : (
            isQuestion && <span className="post-place">Asked the community</span>
          )}
        </div>
        {isQuestion && (
          <span className="chip chip-question">
            <MessageCircleQuestion /> Question
          </span>
        )}
        {item.canDelete && (
          <div className="post-menu">
            <button className="btn btn-ghost btn-icon btn-sm" aria-label="Post options" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <MoreHorizontal />
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

      {slides.length > 0 && <MediaCarousel slides={slides} onDoubleTap={() => setLiked(true)} label={`Media from ${item.actor.displayName}`} />}

      <div className="post-body-wrap">
        <div className="post-actions">
          <button
            className={`icon-action like${like.liked ? ' on' : ''}`}
            aria-pressed={like.liked}
            aria-label={like.liked ? 'Unlike' : 'Like'}
            onClick={() => setLiked(!like.liked)}
          >
            <Heart />
          </button>
          <button className="icon-action" aria-label="Comment" onClick={() => (me ? inputRef.current?.focus() : needLogin())}>
            <MessageCircle />
          </button>
          <button className="icon-action" aria-label="Copy link" onClick={copyLink}>
            <Send />
          </button>
          <span className="spacer" />
          {item.zoo && (
            <Link to={`/z/${item.zoo.id}`} className="icon-action" aria-label="Open park" title="Open park">
              <MapIcon />
            </Link>
          )}
        </div>

        {like.likes > 0 && (
          <div className="post-likes">
            {likers.length > 0 && (
              <span className="avatar-stack" aria-hidden="true">
                {likers.map((u) => (
                  <Avatar key={u.id} user={u} size={20} />
                ))}
              </span>
            )}
            {firstLiker && like.likes > 1 ? (
              <span>
                Liked by <strong>{firstLiker.id === me?.id ? 'you' : firstLiker.displayName}</strong> and <strong>{plural(like.likes - 1, 'other')}</strong>
              </span>
            ) : (
              <strong>{plural(like.likes, 'like')}</strong>
            )}
          </div>
        )}

        <Caption item={item} showBody={!textCard} />
        <SurveyCallout item={item} />

        {!full && commentCount > shownComments.length && (
          <Link to={`/p/${item.id}`} className="post-more-comments">
            View all {plural(commentCount, isQuestion ? 'answer' : 'comment')}
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
      </div>

      {me ? (
        <form className="comment-form" onSubmit={submitComment}>
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
