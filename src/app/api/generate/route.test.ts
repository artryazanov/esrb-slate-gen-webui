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

    it('should scrape game data and return an image', async () => {
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

        // Check if scraper was called
        expect(MockScraperService).toHaveBeenCalled();
        expect(mockGetGameData).toHaveBeenCalledWith('Hades', 'PC');
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
            0.5625
        );
    });
});
