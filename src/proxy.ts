import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LRUCache } from 'lru-cache';

// Rate limit configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 30; // Max requests per window, default 30

// Create the cache for rate limiting
// Note: In a serverless environment (like Vercel), this cache might be reset 
// if the lambda is cold-started. For persistent rate limiting across multiple 
// instances/lambdas, use an external store like Redis (e.g., Upstash).
const rateLimitCache = new LRUCache<string, { count: number; start: number }>({
    max: 500, // Maximum number of IPs to track
    ttl: RATE_LIMIT_WINDOW,
    ttlResolution: 1000,
});

export function proxy(request: NextRequest) {
    // Only apply rate limiting to /api/generate
    if (request.nextUrl.pathname.startsWith('/api/generate')) {
        // Get IP address
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

        // Check if IP is in cache
        const token = rateLimitCache.get(ip) || { count: 0, start: Date.now() };

        // Check if window has expired (should be handled by TTL, but double check logic if needed)
        // With LRUCache TTL, we don't strictly need manual window slide if we just rely on key expiry,
        // but for sliding window or fixed window with count, we can do simple counter.
        // Here we use a simple fixed window reset by TTL or just increment.
        // Detailed: LRUCache TTL removes the item after time. So simple counter works for "X reqs in last Y time" 
        // roughly if we just let it expire. However, simply incrementing doesn't reset 'start' unless we want to.
        // Let's stick to simple: if it exists, increment. If count > max, block.
        // If it expired, it returns undefined, so we start fresh.

        const newCount = token.count + 1;

        // Update cache
        rateLimitCache.set(ip, { count: newCount, start: token.start });

        const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - newCount);

        const response = NextResponse.next();

        // Add RateLimit headers
        response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
        response.headers.set('X-RateLimit-Remaining', remaining.toString());

        if (newCount > RATE_LIMIT_MAX_REQUESTS) {
            return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                    'X-RateLimit-Remaining': '0',
                    'Retry-After': Math.ceil(RATE_LIMIT_WINDOW / 1000).toString(),
                },
            });
        }

        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/api/generate/:path*',
};
