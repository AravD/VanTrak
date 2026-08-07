import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';

// Apply the "reduce motion" preference (My Account → Preferences) before render
// so there's no flash of animation on load.
if (localStorage.getItem('vt_reduce_motion') === 'true') {
  document.documentElement.setAttribute('data-reduce-motion', 'true');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
