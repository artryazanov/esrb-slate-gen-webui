import { NextRequest, NextResponse } from 'next/server';
import { ScraperService, RenderService, ESRBData } from 'esrb-slate-gen';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';
import * as cheerio from 'cheerio';

async function findGameUrl(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://www.esrb.org/search/?searchKeyword=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    // Logic: Look for exact match first, then fallback to first result
    let targetUrl: string | null = null;
    const normalizedQuery = query.toLowerCase().trim();

    $('.game').each((i, el) => {
      if (targetUrl) return; // already found
      const title = $(el).find('.heading a').text().trim().toLowerCase();
      if (title === normalizedQuery) {
        const href = $(el).find('.heading a').attr('href');
        if (href) targetUrl = href;
      }
    });

    if (!targetUrl) {
      // Fallback to first
      const firstHref = $('.game').first().find('.heading a').attr('href');
      if (firstHref) targetUrl = firstHref;
    }

    if (targetUrl) { // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return targetUrl.startsWith('http') ? targetUrl : `https://www.esrb.org${targetUrl}`;
    }
    return null;
  } catch (e) {
    console.error('Error finding game URL:', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, gameTitle, platform, url: providedUrl, manualData, renderOptions } = body;
    const { is4k = false, margin = 0, aspectRatio = 'auto' } = renderOptions || {};

    let heightFactor = 0;
    if (aspectRatio !== 'auto') {
      const parts = aspectRatio.split('/');
      if (parts.length === 2) {
        const w = parseFloat(parts[0]);
        const h = parseFloat(parts[1]);
        if (!isNaN(w) && !isNaN(h) && w > 0) {
          heightFactor = h / w;
        }
      }
    }

    let data: ESRBData;
    let finalGameUrl = '';

    const scraper = new ScraperService();

    if (mode === 'scrape') {
      if (!gameTitle) {
        return NextResponse.json({ error: 'Game title is required for scraping.' }, { status: 400 });
      }

      // Attempt to find URL first
      const foundUrl = await findGameUrl(gameTitle);

      try {
        if (foundUrl) {
          finalGameUrl = foundUrl;
          data = await scraper.getGameDataFromUrl(foundUrl);
        } else {
          // Fallback to original method if my custom search fails (though original doesn't give URL)
          // But if my search fails, original likely fails too or gives result without URL.
          // We'll stick to original method as fallback but we won't have URL.
          data = await scraper.getGameData(gameTitle, platform);
        }
      } catch (error) {
        // If exact URL scrape fails, try the general one as last resort
        console.error('URL Scraping error, falling back to general search:', error);
        try {
          data = await scraper.getGameData(gameTitle, platform);
        } catch (innerError) {
          console.error('Scraping error:', innerError);
          return NextResponse.json({ error: 'Failed to scrape game data. Ensure the title is correct or try manual mode.' }, { status: 500 });
        }
      }

    } else if (mode === 'url') {
      if (!providedUrl) {
        return NextResponse.json({ error: 'URL is required for URL mode.' }, { status: 400 });
      }
      finalGameUrl = providedUrl;
      try {
        data = await scraper.getGameDataFromUrl(providedUrl);
      } catch (error) {
        console.error('URL Scraping error:', error);
        return NextResponse.json({ error: 'Failed to scrape game data from URL. Ensure the URL is correct.' }, { status: 500 });
      }
    } else if (mode === 'manual') {
      if (!manualData || !manualData.ratingCategory) {
        return NextResponse.json({ error: 'Missing required manual data fields.' }, { status: 400 });
      }
      data = {
        title: manualData.title || 'Manual Entry',
        ratingCategory: manualData.ratingCategory,
        descriptors: manualData.descriptors || [],
        interactiveElements: manualData.interactiveElements || [],
      };
    } else {
      return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
    }

    // Generate to a temporary file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `esrb-slate-${crypto.randomUUID()}.png`);

    // Explicitly pass the assets directory from node_modules
    const assetsPath = path.join(process.cwd(), 'node_modules', 'esrb-slate-gen', 'assets');
    const renderer = new RenderService({ assetsDir: assetsPath });

    try {
      await renderer.generate(
        data,
        tempFilePath,
        margin,
        is4k,
        heightFactor
      );
    } catch (error) {
      console.error('Rendering error:', error);
      return NextResponse.json({ error: 'Failed to generate image.' }, { status: 500 });
    }

    // Read the file
    const fileBuffer = await fs.readFile(tempFilePath);

    // Cleanup
    await fs.unlink(tempFilePath).catch(console.error);

    // Prepare headers
    const headers = new Headers();
    headers.set('Content-Type', 'image/png');
    headers.set('Content-Disposition', `attachment; filename="esrb-slate-${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png"`);

    // Add Metadata Headers
    headers.set('X-ESRB-Game-Title', encodeURIComponent(data.title));
    headers.set('X-ESRB-Rating', data.ratingCategory);
    if (finalGameUrl) {
      headers.set('X-ESRB-Game-Url', encodeURIComponent(finalGameUrl));
    }

    // Return the image
    return new NextResponse(fileBuffer, {
      headers: headers,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
