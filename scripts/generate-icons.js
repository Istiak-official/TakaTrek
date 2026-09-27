import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgRounded = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#009966"/>
  <g transform="translate(96, 96) scale(13.33333)">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;

const svgSquare = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#009966"/>
  <g transform="translate(96, 96) scale(13.33333)">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;

const publicDir = path.resolve('public');

async function generate() {
  console.log('Generating PWA icons...');
  
  // 1. icon-512.png (rounded, any)
  await sharp(Buffer.from(svgRounded))
    .resize(512, 512)
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Generated icon-512.png');

  // 2. icon-192.png (rounded, any)
  await sharp(Buffer.from(svgRounded))
    .resize(192, 192)
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Generated icon-192.png');

  // 3. icon-512-maskable.png (square, maskable)
  await sharp(Buffer.from(svgSquare))
    .resize(512, 512)
    .toFile(path.join(publicDir, 'icon-512-maskable.png'));
  console.log('Generated icon-512-maskable.png');

  // 4. icon-192-maskable.png (square, maskable)
  await sharp(Buffer.from(svgSquare))
    .resize(192, 192)
    .toFile(path.join(publicDir, 'icon-192-maskable.png'));
  console.log('Generated icon-192-maskable.png');

  // 5. apple-touch-icon.png (rounded, iOS)
  await sharp(Buffer.from(svgRounded))
    .resize(180, 180)
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
