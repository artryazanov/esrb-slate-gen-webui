/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';
import { ScraperService, RenderService } from 'esrb-slate-gen';

// Automatically mock the module
jest.mock('esrb-slate-gen');

// Mock fs/promises
jest.mock('fs/promises', () => ({
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock-image-data')),
    unlink: jest.fn().mockResolvedValue(undefined),
}));

// Mock crypto
jest.mock('crypto', () => ({
    randomUUID: () => 'mock-uuid',
}));

describe('API Route: /api/generate', () => {
    const MockScraperService = ScraperService as unknown as jest.Mock;
    const MockRenderService = RenderService as unknown as jest.Mock;

    // Variables to hold the mock functions we inject
    let mockGetGameData: jest.Mock;
    let mockGetGameDataFromUrl: jest.Mock;
    let mockGenerate: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGetGameData = jest.fn().mockResolvedValue({
            title: 'Mock Game',
            ratingCategory: 'M',
            descriptors: ['Blood'],
            interactiveElements: [],
        });

        mockGetGameDataFromUrl = jest.fn().mockResolvedValue({
            title: 'Mock Game URL',
            ratingCategory: 'T',
            descriptors: ['Violence'],
            interactiveElements: [],
        });

        mockGenerate = jest.fn().mockResolvedValue(undefined);

        // Setup Mock Implementations using the captured variables
        MockScraperService.mockImplementation(() => ({
            getGameData: mockGetGameData,
            getGameDataFromUrl: mockGetGameDataFromUrl,
        }));

        MockRenderService.mockImplementation(() => ({
            generate: mockGenerate,
        }));
    });

    it('should return 400 if mode is missing or invalid', async () => {
        const req = new NextRequest('http://localhost/api/generate', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('Invalid mode.');
    });

    it('should scrape game data and return an image and correct headers', async () => {
        // Mock global fetch for custom search
        global.fetch = jest.fn().mockResolvedValue({
            text: async () => `
                <div class="game">
                    <div class="heading">
                        <a href="/ratings/39986/hades/">Hades</a>
                    </div>
                </div>
            `,
        });

        // Mock getGameDataFromUrl to return data consistent with what we expect
        // The mock setup in beforeEach returns 'Mock Game URL' title for mockGetGameDataFromUrl
        // We probably want to align titles or just check what's returned.
        // Let's rely on the predefined mocks.

        const req = new NextRequest('http://localhost/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'scrape',
                gameTitle: 'Hades',
                platform: 'PC',
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/png');

        // Assert Headers
        // Note: mockGetGameDataFromUrl returns 'Mock Game URL' as title
        expect(decodeURIComponent(res.headers.get('X-ESRB-Game-Title') || '')).toBe('Mock Game URL');
        expect(res.headers.get('X-ESRB-Rating')).toBe('T');
        // The mockGetGameDataFromUrl is called because findGameUrl found a URL
        expect(decodeURIComponent(res.headers.get('X-ESRB-Game-Url') || '')).toBe('https://www.esrb.org/ratings/39986/hades/');

        // Check if scraper was called with URL because custom search succeeded
        expect(MockScraperService).toHaveBeenCalled();
        expect(mockGetGameDataFromUrl).toHaveBeenCalledWith('https://www.esrb.org/ratings/39986/hades/');
    });

    it('should fallback to general search if custom search fails or returns no URL', async () => {
        // Mock global fetch to return nothing or fail
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error')); // Or resolve with empty HTML

        const req = new NextRequest('http://localhost/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'scrape',
                gameTitle: 'Unknown Game',
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);

        // Assert Headers (Title and Rating should still be present from general scrape)
        // mockGetGameData returns 'Mock Game'
        expect(decodeURIComponent(res.headers.get('X-ESRB-Game-Title') || '')).toBe('Mock Game');

        // URL header might be missing or empty if we fell back to general scrape
        expect(res.headers.get('X-ESRB-Game-Url')).toBeNull();

        expect(mockGetGameData).toHaveBeenCalledWith('Unknown Game', undefined);
    });

    it('should scrape game data from URL and return an image', async () => {
        const req = new NextRequest('http://localhost/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'url',
                url: 'https://www.esrb.org/ratings/39986/hades/',
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/png');

        // Check if scraper was called
        expect(MockScraperService).toHaveBeenCalled();
        expect(mockGetGameDataFromUrl).toHaveBeenCalledWith('https://www.esrb.org/ratings/39986/hades/');
    });

    it('should return 400 if gameTitle is missing in scrape mode', async () => {
        const req = new NextRequest('http://localhost/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'scrape',
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('Game title is required for scraping.');
    });

    it('should use manual data and return an image', async () => {
        const manualData = {
            title: 'Manual Game',
            ratingCategory: 'E',
            descriptors: ['Fun'],
            interactiveElements: [],
        };
        const req = new NextRequest('http://localhost/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'manual',
                manualData,
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/png');

        // Check if renderer was called with manual data
        expect(MockRenderService).toHaveBeenCalled();
        expect(mockGenerate).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Manual Game',
                ratingCategory: 'E'
            }),
            expect.stringContaining('mock-uuid'),
            0,
            false,
            0 // Expect auto mode (0) by default
        );
    });

    it('should correctly calculate heightFactor from aspectRatio', async () => {
        const manualData = {
            title: 'Wide Game',
            ratingCategory: 'E',
        };
        const req = new NextRequest('http://localhost/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'manual',
                manualData,
                renderOptions: {
                    aspectRatio: '21/9'
                }
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);

        expect(MockRenderService).toHaveBeenCalled();
        expect(mockGenerate).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            0,
            false,
            expect.closeTo(9 / 21, 5) // 21:9 input means 9/21 height factor
        );
    });
});
