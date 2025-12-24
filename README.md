# ESRB Slate Generator Web UI

A modern, responsive web interface for generating broadcast-ready ESRB rating slates. This tool serves as a frontend for the [esrb-slate-gen](https://github.com/artryazanov/esrb-slate-gen) library, allowing you to easily create high-resolution rating images by scraping official data or entering details manually.

**[Live Demo](https://esrb-slate-gen-webui.vercel.app/)**

<img src="https://raw.githubusercontent.com/artryazanov/esrb-slate-gen-webui/main/esrb-slate-gen-webui-preview.png" alt="ESRB Slate Gen Preview" width="640" />

[![CI](https://github.com/artryazanov/esrb-slate-gen-webui/actions/workflows/ci.yml/badge.svg)](https://github.com/artryazanov/esrb-slate-gen-webui/actions/workflows/ci.yml)
[![Docker Verify](https://github.com/artryazanov/esrb-slate-gen-webui/actions/workflows/docker-verify.yml/badge.svg)](https://github.com/artryazanov/esrb-slate-gen-webui/actions/workflows/docker-verify.yml)
[![License](https://img.shields.io/github/license/artryazanov/esrb-slate-gen-webui)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=flat&logo=react&logoColor=61DAFB)

## Features

- **Automatic Data Fetching**: Instantly fetch game rating information directly from the ESRB website by **Game Title** or **URL**.
- **Manual Entry Mode**: Fully customizable mode to manually input Rating Category, Content Descriptors, and Interactive Elements.
- **High-Resolution Output**: Generate standard or 4K resolution PNG images.
- **Customizable Layout**: Adjust margins and aspect ratios (Auto, 16:9, 21:9, etc.) to fit specific broadcast requirements.
- **Live Preview**: Real-time visual feedback of the generated slate with detailed game info.
- **Dark Mode**: Sleek UI with support for both light and dark themes.
- **Docker Support**: Containerized for easy deployment.
- **Comprehensive Testing**: Fully tested with Jest and React Testing Library.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Jest](https://jestjs.io/) & [React Testing Library](https://testing-library.com/)
- **Core Library**: [esrb-slate-gen](https://www.npmjs.com/package/esrb-slate-gen)

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm, yarn, or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/artryazanov/esrb-slate-gen-webui.git
   cd esrb-slate-gen-webui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Docker Usage

You can build and run the application using Docker.

1. **Build the image:**
   ```bash
   docker build -t esrb-webui .
   ```

2. **Run the container:**
   ```bash
   docker run -p 3000:3000 esrb-webui
   ```

Access the application at [http://localhost:3000](http://localhost:3000).

## Usage Guide

1. **Select Mode**: Choose between "Auto-fill", "By URL", or "Manual".
2. **Input Data**:
   - *Auto-fill*: Enter the Game Title and optionally filter by Platform.
   - *By URL*: Paste a specific game URL from the ESRB website.
   - *Manual*: Select the Rating, then enter Descriptors (comma-separated), and Interactive Elements.
3. **Configure Options**: Toggle "Render in 4K", set "Margin", or choose an "Aspect Ratio".
4. **Generate**: Click "Generate Slate".
5. **Download**: Once the preview appears, click "Download Image" to save the PNG.

## Development

### Running Tests

This project uses Jest and React Testing Library for ensuring code quality.

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
