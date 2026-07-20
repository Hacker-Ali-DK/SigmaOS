const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="128" fill="#03050C"/>
  <circle cx="256" cy="256" r="220" fill="url(#bg-gradient)" stroke="#1E293B" stroke-width="8"/>
  
  <!-- Glowing Path -->
  <g filter="url(#glow)">
    <path d="M256 140V372M140 256H372" stroke="#3A86FF" stroke-width="48" stroke-linecap="round"/>
    <path d="M360 160L380 180M380 160L360 180" stroke="#4CC9F0" stroke-width="16" stroke-linecap="round"/>
    <path d="M140 340L150 350M150 340L140 350" stroke="#4CC9F0" stroke-width="12" stroke-linecap="round"/>
  </g>

  <!-- Inner glowing plus -->
  <path d="M256 140V372M140 256H372" stroke="#4CC9F0" stroke-width="20" stroke-linecap="round"/>

  <!-- Four point star (crescent companion style) -->
  <path d="M370 120 C370 135, 375 140, 390 140 C375 140, 370 145, 370 160 C370 145, 365 140, 350 140 C365 140, 370 135, 370 120 Z" fill="#4CC9F0"/>
  <path d="M390 170 C390 178, 393 180, 400 180 C393 180, 390 183, 390 190 C390 183, 387 180, 380 180 C387 180, 390 178, 390 170 Z" fill="#3A86FF"/>

  <defs>
    <radialGradient id="bg-gradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(256 256) rotate(90) scale(220)">
      <stop stop-color="#0B132B"/>
      <stop offset="1" stop-color="#03050C"/>
    </radialGradient>
    <filter id="glow" x="100" y="100" width="312" height="312" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="24" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
</svg>
`;

const publicDir = path.join(__dirname, '..', 'public');

async function generate() {
  try {
    const buffer = Buffer.from(svgIcon);
    
    // Generate 512x512
    await sharp(buffer)
      .resize(512, 512)
      .toFile(path.join(publicDir, 'icon-512.png'));
    console.log('Generated icon-512.png');

    // Generate 192x192
    await sharp(buffer)
      .resize(192, 192)
      .toFile(path.join(publicDir, 'icon-192.png'));
    console.log('Generated icon-192.png');
    
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

generate();
