import { lazy, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useMe } from './auth';
import { Layout } from './components/Layout';
import { PageLoader } from './components/ui';
import { AuthPage } from './pages/AuthPage';
import { ExplorePage } from './pages/ExplorePage';
import { ActivityPage } from './pages/ActivityPage';
import { FeedPage } from './pages/FeedPage';
import { HomePage } from './pages/HomePage';
import { Landing } from './pages/Landing';
import { MyZoosPage } from './pages/MyZoosPage';
import { NotFound } from './pages/NotFound';
import { PeoplePage } from './pages/PeoplePage';
import { PostPage } from './pages/PostPage';
import { ProfilePage } from './pages/ProfilePage';

// The map-heavy pages and the guide load on demand, keeping the first download small.
export const loadPlanner = () => import('./pages/planner/PlannerPage');
const PlannerPage = lazy(() => loadPlanner().then((m) => ({ default: m.PlannerPage })));
const ZooPage = lazy(() => import('./pages/ZooPage').then((m) => ({ default: m.ZooPage })));
const GuidePage = lazy(() => import('./pages/GuidePage').then((m) => ({ default: m.GuidePage })));

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useMe();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function Home() {
  const { me, loading } = useMe();
  if (loading) return <PageLoader />;
  return me ? <HomePage /> : <Landing />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, which React would call as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route
            path="social"
            element={
              <RequireAuth>
                <FeedPage />
              </RequireAuth>
            }
          />
          <Route
            path="activity"
            element={
              <RequireAuth>
                <ActivityPage />
              </RequireAuth>
            }
          />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="guide" element={<GuidePage />} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="register" element={<AuthPage mode="register" />} />
          <Route
            path="zoos"
            element={
              <RequireAuth>
                <MyZoosPage />
              </RequireAuth>
            }
          />
          <Route
            path="zoos/:id/edit"
            element={
              <RequireAuth>
                <PlannerPage />
              </RequireAuth>
            }
          />
          <Route path="z/:id" element={<ZooPage />} />
          <Route path="u/:username" element={<ProfilePage />} />
          <Route path="p/:id" element={<PostPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
