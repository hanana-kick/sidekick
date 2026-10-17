import { createRoot } from 'react-dom/client';
import '../src/index.js';
import { StudioApp } from './studio-app';
import { StudioController } from './studio-controller.js';
import './style.css';

let storage: Storage | undefined;
try { storage = window.localStorage; } catch { /* The editor remains usable without storage. */ }
const controller = new StudioController(storage);
const root = document.getElementById('root');
if (!root) throw new Error('Studio root is missing.');
createRoot(root).render(<StudioApp controller={controller} />);
