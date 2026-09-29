// Demo mode lets the dashboard render instantly from static sample data
// (lib/mockData.ts) instead of calling the FastAPI backend — useful for
// offline demos/judging when the backend isn't reachable. Off by default:
// the dashboard calls the real API unless explicitly opted in.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
