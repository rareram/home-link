import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // defaults to auto
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const method = searchParams.get('method') || 'HEAD';

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const start = performance.now();
    // Use a short timeout for health checks
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    const res = await fetch(url, {
      method,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    const ms = Math.round(performance.now() - start);

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      ms,
    });
  } catch (error: any) {
    // Catches network errors, DNS errors, timeouts etc.
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to fetch', message: error.message }, { status: 500 });
  }
}
