import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiError, errorMessage } from '../api/client';
import { PostCard } from '../components/feed/PostCard';
import { PageLoader } from '../components/ui';
import { NotFound } from './NotFound';

/** One post (or park update) with all of its comments — what shared links and "View all comments" open. */
export function PostPage() {
  const { id } = useParams();
  const postId = Number(id);
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['activity', postId], queryFn: () => api.activity(postId), enabled: Number.isInteger(postId) });

  if (!Number.isInteger(postId)) return <NotFound what="post" />;
  if (query.isPending) return <PageLoader />;
  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFound what="post" />;
    return <div className="page">{errorMessage(query.error)}</div>;
  }
  return (
    <div className="page post-page">
      <button className="btn btn-ghost btn-sm post-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
        <ArrowLeft /> Back
      </button>
      <PostCard item={query.data} full onDeleted={() => navigate(`/u/${query.data.actor.username}`, { replace: true })} />
      <p className="subtle post-page-foot">
        More from <Link to={`/u/${query.data.actor.username}`}>{query.data.actor.displayName}</Link>
      </p>
    </div>
  );
}
