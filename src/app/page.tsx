'use client';

import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { Download, Monitor, Moon, Sun, Search, FileEdit, Loader2, Gamepad2, Link } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// UI Components
const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden", className)}>
    {children}
  </div>
);

const Label = ({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
  <label htmlFor={htmlFor} className={cn("block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5", className)}>
    {children}
  </label>
);

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 focus:border-transparent transition-all",
      className
    )}
    {...props}
  />
);

const Select = ({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
    <select
      className={cn(
        "w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 focus:border-transparent appearance-none transition-all",
        className
      )}
      {...props}
    />
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  </div>
);

const Button = ({ className, variant = 'primary', isLoading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline', isLoading?: boolean }) => {
  const variants = {
    primary: "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20",
    secondary: "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100",
    outline: "border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
        variants[variant],
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

export default function Page() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'scrape' | 'manual' | 'url'>('scrape');
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foundGameInfo, setFoundGameInfo] = useState<{ title: string; url: string; rating: string } | null>(null);

  // Form State
  const [gameTitle, setGameTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [url, setUrl] = useState('');

  const [ratingCategory, setRatingCategory] = useState('E');
  const [descriptors, setDescriptors] = useState('');
  const [interactiveElements, setInteractiveElements] = useState('');

  const [is4k, setIs4k] = useState(false);
  const [margin, setMargin] = useState(0);
  const [aspectRatio, setAspectRatio] = useState('auto');

  // Wait for hydration to avoid mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setImageUrl(null);
    setFoundGameInfo(null);

    try {
      const payload = {
        mode,
        gameTitle: mode === 'scrape' ? gameTitle : undefined,
        platform: mode === 'scrape' && platform ? platform : undefined,
        url: mode === 'url' ? url : undefined,
        manualData: mode === 'manual' ? {

          ratingCategory,
          descriptors: descriptors.split(',').map(s => s.trim()).filter(Boolean),
          interactiveElements: interactiveElements.split(',').map(s => s.trim()).filter(Boolean),
        } : undefined,
        renderOptions: {
          is4k,
          margin: Number(margin),
          aspectRatio,
        }
      };

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate slate.');
      }

      const blob = await res.blob();
      const urlObject = URL.createObjectURL(blob);
      setImageUrl(urlObject);

      const title = decodeURIComponent(res.headers.get('X-ESRB-Game-Title') || '');
      const urlHeader = decodeURIComponent(res.headers.get('X-ESRB-Game-Url') || '');
      const rating = res.headers.get('X-ESRB-Rating') || '';

      if (title || urlHeader) {
        setFoundGameInfo({ title, url: urlHeader, rating });
      }

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-zinc-950/70 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <Gamepad2 className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">ESRB Slate Gen</span>
          </div>

          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Controls Section */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Create Your Slate</h1>
              <p className="text-zinc-500 dark:text-zinc-400 mb-2">Generate broadcast-ready ESRB ratings in seconds.</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Open source project. <a href="https://github.com/artryazanov/esrb-slate-gen-webui" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center">Check it out on GitHub</a>
              </p>
            </div>

            <Card className="p-6">
              {/* Mode Switcher */}
              <div className="flex space-x-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg mb-6">
                <button
                  onClick={() => setMode('scrape')}
                  className={cn(
                    "flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all",
                    mode === 'scrape'
                      ? "bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Auto-fill
                </button>
                <button
                  onClick={() => setMode('url')}
                  className={cn(
                    "flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all",
                    mode === 'url'
                      ? "bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  <Link className="w-4 h-4 mr-2" />
                  By URL
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={cn(
                    "flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all",
                    mode === 'manual'
                      ? "bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  <FileEdit className="w-4 h-4 mr-2" />
                  Manual
                </button>
              </div>

              {/* Scrape Form */}
              {mode === 'scrape' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div>
                    <Label htmlFor="gameTitle">Game Title</Label>
                    <Input
                      id="gameTitle"
                      placeholder="e.g. Hades"
                      value={gameTitle}
                      onChange={(e) => setGameTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="platform">Platform</Label>
                    <Select
                      id="platform"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                    >
                      <option value="">All Platforms</option>
                      <option value="Nintendo Switch 2">Nintendo Switch 2</option>
                      <option value="Nintendo Switch">Nintendo Switch</option>
                      <option value="PlayStation 5">PlayStation 5</option>
                      <option value="PlayStation 4">PlayStation 4</option>
                      <option value="Xbox Series">Xbox Series</option>
                      <option value="Xbox One">Xbox One</option>
                      <option value="PC">PC</option>
                      <option value="Other">Other</option>
                    </Select>
                  </div>
                </div>
              )}

              {/* URL Form */}
              {mode === 'url' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div>
                    <Label htmlFor="url">ESRB Game URL</Label>
                    <Input
                      id="url"
                      placeholder="https://www.esrb.org/ratings/..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Manual Form */}
              {mode === 'manual' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="rating">Rating</Label>
                      <Select
                        id="rating"
                        value={ratingCategory}
                        onChange={(e) => setRatingCategory(e.target.value)}
                      >
                        <option value="E">Everyone (E)</option>
                        <option value="E10plus">Everyone 10+ (E10+)</option>
                        <option value="T">Teen (T)</option>
                        <option value="M">Mature (M)</option>
                        <option value="AO">Adults Only (AO)</option>
                        <option value="RP">Rating Pending (RP)</option>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="descriptors">Content Descriptors</Label>
                    <Input
                      id="descriptors"
                      placeholder="e.g. Fantasy Violence, Blood"
                      value={descriptors}
                      onChange={(e) => setDescriptors(e.target.value)}
                    />
                    <p className="text-xs text-zinc-500 mt-1">Comma separated</p>
                  </div>
                  <div>
                    <Label htmlFor="interactive">Interactive Elements</Label>
                    <Input
                      id="interactive"
                      placeholder="e.g. In-Game Purchases"
                      value={interactiveElements}
                      onChange={(e) => setInteractiveElements(e.target.value)}
                    />
                    <p className="text-xs text-zinc-500 mt-1">Comma separated</p>
                  </div>
                </div>
              )}

              {/* Common Options */}
              <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="mb-0">Render in 4K</Label>
                  <button
                    role="switch"
                    aria-checked={is4k}
                    onClick={() => setIs4k(!is4k)}
                    className={cn(
                      "w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500",
                      is4k ? "bg-violet-600" : "bg-zinc-200 dark:bg-zinc-700"
                    )}
                  >
                    <span className={cn(
                      "block w-4 h-4 rounded-full bg-white transform transition-transform mt-1 ml-1",
                      is4k ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>

                <div>
                  <Label htmlFor="margin">Margin (0 for fullscreen)</Label>
                  <Input
                    id="margin"
                    type="number"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                  />
                </div>

                <div>
                  <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                  <Select
                    id="aspectRatio"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="16/9">16:9</option>
                    <option value="17/9">17:9</option>
                    <option value="18/9">18:9</option>
                    <option value="19/9">19:9</option>
                    <option value="20/9">20:9</option>
                    <option value="21/9">21:9</option>
                  </Select>
                </div>
              </div>

              <div className="mt-8">
                <Button
                  className="w-full h-12 text-lg"
                  onClick={handleGenerate}
                  isLoading={loading}
                  disabled={
                    (mode === 'scrape' && !gameTitle) ||
                    (mode === 'url' && !url)
                  }
                >
                  {loading ? 'Generating...' : 'Generate Slate'}
                </Button>
                {error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
                    {error}
                  </div>
                )}
              </div>

            </Card>
          </div>

          {/* Preview Section */}
          <div className="lg:sticky lg:top-24 h-fit">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Monitor className="w-5 h-5 mr-2" />
              Preview
            </h2>
            <Card className="min-h-[300px] flex flex-col items-center justify-center p-2 bg-zinc-100 dark:bg-zinc-900/50">
              {imageUrl ? (
                <div className="space-y-4 w-full">
                  {foundGameInfo && (
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 w-full animate-in fade-in slide-in-from-top-2 text-left">
                      <h3 className="font-bold text-lg leading-tight mb-1 text-zinc-900 dark:text-zinc-100">{foundGameInfo.title} <span className="text-zinc-500 text-base font-normal">[{foundGameInfo.rating}]</span></h3>
                      {foundGameInfo.url && (
                        <a href={foundGameInfo.url} target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline text-sm flex items-center inline-flex font-medium">
                          View on ESRB.org <Link className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </div>
                  )}
                  <div className="relative rounded-lg overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Generated ESRB Slate" className="w-full h-auto" />
                  </div>
                  <div className="flex justify-center">
                    <a
                      href={imageUrl}
                      download={`esrb-slate.png`}
                      className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 font-medium hover:scale-105 transition-transform"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Image
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center text-zinc-400 dark:text-zinc-600">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                    <Monitor className="w-8 h-8 opacity-50" />
                  </div>
                  <p>No slate generated yet.</p>
                  <p className="text-sm">Fill the form and hit Generate!</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main >
    </div >
  );
}
