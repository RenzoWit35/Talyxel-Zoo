import { MapPinned } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '../components/ui';

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="page">
      <EmptyState
        icon={<MapPinned />}
        title={`This ${what} wandered off`}
        action={
          <Link to="/" className="btn btn-primary">
            Back to the entrance
          </Link>
        }
      >
        It may have been moved, unpublished or never existed.
      </EmptyState>
    </div>
  );
}
