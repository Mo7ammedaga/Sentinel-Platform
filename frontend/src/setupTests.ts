// jsdom (react-scripts 5's test environment) doesn't define TextEncoder/
// TextDecoder globally, but react-router v7 needs them at import time.
// Node itself has them (via `util`) — just not exposed on the jsdom global.
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// jest-dom adds custom DOM element matchers (toBeInTheDocument, etc).
// react-scripts runs this automatically before every test file.
import '@testing-library/jest-dom';
