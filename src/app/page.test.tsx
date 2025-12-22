import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Page from './page';

// Mock next-themes
jest.mock('next-themes', () => ({
    useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Page Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the page title and default mode (Scrape)', () => {
        render(<Page />);
        expect(screen.getByText('Create Your Slate')).toBeInTheDocument();
        expect(screen.getByText('Auto-fill')).toBeInTheDocument();
    });

    it('switches to Manual mode', () => {
        render(<Page />);
        const manualButton = screen.getByText('Manual');
        fireEvent.click(manualButton);
        expect(screen.getByLabelText('Content Descriptors')).toBeInTheDocument();
    });

    it('handles scrape form submission and displays found game info', async () => {
        // Mock global fetch to return headers
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            blob: async () => new Blob(['mock-image'], { type: 'image/png' }),
            headers: new Headers({
                'X-ESRB-Game-Title': encodeURIComponent('Found Game Title'),
                'X-ESRB-Game-Url': encodeURIComponent('https://esrb.org/game'),
                'X-ESRB-Rating': 'M'
            })
        });

        // Mock URL.createObjectURL
        global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

        render(<Page />);

        const titleInput = screen.getByLabelText('Game Title');
        fireEvent.change(titleInput, { target: { value: 'Test Game' } });

        const generateButton = screen.getByText('Generate Slate');
        fireEvent.click(generateButton);

        expect(screen.getByText('Generating...')).toBeInTheDocument();

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('"gameTitle":"Test Game"'),
            }));
        });

        await waitFor(() => {
            expect(screen.getByAltText('Generated ESRB Slate')).toBeInTheDocument();

            // Check for Found Game Info Card
            expect(screen.getByText('Found Game Title')).toBeInTheDocument();
            expect(screen.getByText('[M]')).toBeInTheDocument();
            const link = screen.getByText('View on ESRB.org');
            expect(link).toBeInTheDocument();
            expect(link.closest('a')).toHaveAttribute('href', 'https://esrb.org/game');
        });
    });

    it('displays error on failed generation', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Mock Error' }),
        });

        render(<Page />);

        const titleInput = screen.getByLabelText('Game Title');
        fireEvent.change(titleInput, { target: { value: 'Test Game' } });

        const generateButton = screen.getByText('Generate Slate');
        fireEvent.click(generateButton);

        await waitFor(() => {
            expect(screen.getByText('Mock Error')).toBeInTheDocument();
        });
    });
});
