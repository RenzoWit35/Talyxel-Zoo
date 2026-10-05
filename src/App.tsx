import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useMe } from './auth';
import { Layout } from './components/Layout';
import { PageLoader } from './components/ui';
import { AuthPage } from './pages/AuthPage';
import { ExplorePage } from './pages/ExplorePage';
import { FeedPage } from './pages/FeedPage';
import { Landing } from './pages/Landing';
import { MyZoosPage } from './pages/MyZoosPage';
import { NotFound } from './pages/NotFound';
import { PeoplePage } from './pages/PeoplePage';
import { PlannerPage } from './pages/planner/PlannerPage';
import { ProfilePage } from './pages/ProfilePage';
import { ZooPage } from './pages/ZooPage';

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
  return me ? <FeedPage /> : <Landing />;
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
          <Route path="explore" element={<ExplorePage />} />
          <Route path="people" element={<PeoplePage />} />
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
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
