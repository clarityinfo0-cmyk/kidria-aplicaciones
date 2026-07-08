import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Definitions of premium gradients and glow effects -->
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050508" />
      <stop offset="50%" stop-color="#09090f" />
      <stop offset="100%" stop-color="#121026" />
    </linearGradient>

    <!-- Glowing Tech Cyan/Blue Gradient -->
    <linearGradient id="cyanGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#22d3ee" />
    </linearGradient>

    <!-- Futuristic Purple/Magenta Gradient -->
    <linearGradient id="purpleGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="40%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>

    <!-- Circuit Trace Glow Filter -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    
    <!-- Heavy Glow Filter for Nodes -->
    <filter id="heavyGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComponentTransfer in="blur" result="boost">
        <feFuncA type="linear" slope="1.5"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="boost" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Solid Background with Safe Margins -->
  <rect width="512" height="512" fill="url(#bgGrad)" />

  <!-- Background Decorative Glowing Aura -->
  <circle cx="256" cy="256" r="160" fill="#4f46e5" opacity="0.15" filter="blur(40px)" />
  <circle cx="180" cy="256" r="120" fill="#06b6d4" opacity="0.12" filter="blur(30px)" />

  <!-- KIDRIA "K" LOGO (PERFECTLY CENTERED AND COMPASS-ALIGNED) -->
  <g transform="translate(16, 0)">
    <!-- 1. Left Vertical Stem - Futuristic Circuit Pillar -->
    <path d="M 145,110 L 195,110 L 195,402 L 145,402 Z" fill="#0b0f19" opacity="0.6" rx="4" />
    <path d="M 145,110 L 195,110 L 195,402 L 145,402 Z" stroke="url(#cyanGrad)" stroke-width="2" fill="none" opacity="0.3" />

    <!-- Sleek Circuit Lines and Nodes -->
    <line x1="170" y1="110" x2="170" y2="402" stroke="url(#cyanGrad)" stroke-width="4" filter="url(#glow)" />
    
    <path d="M 170,140 L 150,165 L 150,210" stroke="#06b6d4" stroke-width="3" fill="none" filter="url(#glow)" />
    <circle cx="150" cy="210" r="5" fill="#22d3ee" filter="url(#heavyGlow)" />

    <path d="M 170,180 L 190,205 L 190,240" stroke="#22d3ee" stroke-width="3" fill="none" filter="url(#glow)" />
    <circle cx="190" cy="240" r="5" fill="#22d3ee" filter="url(#heavyGlow)" />

    <path d="M 170,360 L 150,335 L 150,290" stroke="#06b6d4" stroke-width="3" fill="none" filter="url(#glow)" />
    <circle cx="150" cy="290" r="5" fill="#22d3ee" filter="url(#heavyGlow)" />

    <path d="M 170,320 L 190,295 L 190,270" stroke="#22d3ee" stroke-width="3" fill="none" filter="url(#glow)" />
    <circle cx="190" cy="270" r="5" fill="#22d3ee" filter="url(#heavyGlow)" />

    <!-- Corner Decorative Accents on Left Pillar -->
    <line x1="145" y1="120" x2="155" y2="110" stroke="#22d3ee" stroke-width="2" />
    <line x1="145" y1="392" x2="155" y2="402" stroke="#22d3ee" stroke-width="2" />

    <!-- 2. Right Diagonal Arms (Futuristic Violet/Magenta Polygons) -->
    <path d="M 195,256 L 315,136 L 415,136 L 255,296 Z" fill="url(#purpleGrad)" filter="url(#glow)" />
    <path d="M 195,256 L 315,136 L 415,136" stroke="#f43f5e" stroke-width="2.5" fill="none" opacity="0.8" />

    <path d="M 235,276 L 395,402 L 445,402 L 275,256 Z" fill="url(#purpleGrad)" filter="url(#glow)" />
    <path d="M 235,276 L 395,402 L 445,402" stroke="#a78bfa" stroke-width="2.5" fill="none" opacity="0.8" />
  </g>
</svg>`;

async function main() {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write the vector SVG
  const svgPath = path.join(publicDir, 'icon.svg');
  fs.writeFileSync(svgPath, SVG_CONTENT, 'utf8');
  console.log('✓ Public SVG icon written successfully.');

  // 2. Generate PNG 192x192
  await sharp(svgPath)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✓ Public icon-192.png generated.');

  // 3. Generate PNG 512x512
  await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ Public icon-512.png generated.');

  // 4. Generate JPG logo.jpg
  await sharp(svgPath)
    .resize(512, 512)
    .jpeg({ quality: 95 })
    .toFile(path.join(publicDir, 'logo.jpg'));
  console.log('✓ Public logo.jpg generated.');

  console.log('🎉 All PWA icon assets generated successfully with pixel-perfect sharp vectors!');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
