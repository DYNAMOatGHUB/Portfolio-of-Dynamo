import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Cursor, Footer, Nav, Preloader } from './components/Chrome';
import Home from './pages/Home';
import PdfKnowledge from './pages/PdfKnowledge';
import SlmRouter from './pages/SlmRouter';
import PoseFit from './pages/PoseFit';
import { PROFILE } from './content';
import { Link, RouterProvider, useRouter } from './lib/router';
import { useMeta } from './lib/motion';
import { initSmoothScroll } from './lib/smooth';

function NotFound() {
  useMeta(`Not found | ${PROFILE.name}`, 'This page does not exist.');
  return (
    <main id="main" className="page">
      <section className="hero" style={{ justifyContent: 'center' }}>
        <span className="mono muted">Error 404</span>
        <h1 className="display h-xl" style={{ margin: '1rem 0 2rem' }}>Lost in <span className="italic">the reel.</span></h1>
        <Link to="/" className="pill solid" style={{ alignSelf: 'flex-start' }}><span className="dot" /> Back to the index</Link>
      </section>
      <Footer />
    </main>
  );
}

function Routes() {
  const { path } = useRouter();
  switch (path) {
    case '/': return <Home key="home" />;
    case '/pdf-knowledge': return <PdfKnowledge key="pdf-knowledge" />;
    case '/slmrouter': return <SlmRouter key="slmrouter" />;
    case '/posefit': return <PoseFit key="posefit" />;
    default: return <NotFound key="404" />;
  }
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => initSmoothScroll(), []);
  return (
    <RouterProvider>
      <a href="#main" className="skip-link">Skip to content</a>
      {!loaded && <Preloader onDone={() => setLoaded(true)} />}
      <Nav />
      <Cursor />
      <Routes />
      <Analytics />
    </RouterProvider>
  );
}
