import { NextRequest, NextResponse } from 'next/server';
import { ScraperService, RenderService, ESRBData } from 'esrb-slate-gen';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, gameTitle, platform, manualData, renderOptions } = body;
    const { is4k = false, margin = 0, heightFactor = 9 / 16 } = renderOptions || {};

    let data: ESRBData;

    if (mode === 'scrape') {
      if (!gameTitle) {
        return NextResponse.json({ error: 'Game title is required for scraping.' }, { status: 400 });
      }
      // Note: ScraperService is used here.
      // If the environment doesn't have internet access, this might fail or need mocking.
      // But for the purpose of the code, this is the implementation.
      const scraper = new ScraperService();
      try {
        data = await scraper.getGameData(gameTitle, platform);
      } catch (error) {
        console.error('Scraping error:', error);
        return NextResponse.json({ error: 'Failed to scrape game data. Ensure the title is correct or try manual mode.' }, { status: 500 });
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

    // Return the image
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="esrb-slate-${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png"`,
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
