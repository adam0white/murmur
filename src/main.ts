import './ui/style.css';
import { start, tester } from './ui/app.ts';

// For automated playtesters, on every build: read the state, speak, turn the page, skip ahead.
if (new URLSearchParams(location.search).get('lab') === '1')
  (window as unknown as { __murmur: typeof tester }).__murmur = tester;
start();
