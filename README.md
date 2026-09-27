# TakaTrek

A modern web application for tracking and managing your daily life.

## Requirements

* Node.js 18+
* npm

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/TakaTrek.git
cd TakaTrek
npm install
```

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Start the development server:

```bash
npm run dev
```

## Deployment

The application can be deployed to any platform that supports Node.js, such as Vercel, Netlify.

Configure the following environment variable in your hosting platform before deployment:

```env
GEMINI_API_KEY=your_gemini_api_key
```

## Security

* Do not commit `.env.local` to version control.
* Store API keys using your hosting provider's environment variable system.
