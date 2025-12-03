const fs = require('fs');
const https = require('https');

const USERNAME = 'logical-luke';
const OUTPUT_PATH = './constellation.svg';

// Fetch GitHub contribution data
async function fetchContributions() {
  const query = `
    query {
      user(login: "${USERNAME}") {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'constellation-generator'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data?.user?.contributionsCollection?.contributionCalendar?.weeks) {
            const days = json.data.user.contributionsCollection.contributionCalendar.weeks
              .flatMap(w => w.contributionDays)
              .slice(-30); // Last 30 days
            resolve(days);
          } else {
            // Fallback to random seed if API fails
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.write(JSON.stringify({ query }));
    req.end();
  });
}

// Seeded random number generator
function seededRandom(seed) {
  let state = seed;
  return function() {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Generate constellation points based on contributions or date seed
function generateConstellation(contributions, random) {
  const width = 800;
  const height = 200;
  const padding = 60;

  // Generate 8-12 main points
  const numPoints = Math.floor(random() * 5) + 8;
  const points = [];

  // Distribute points across the width with some variation
  for (let i = 0; i < numPoints; i++) {
    const baseX = padding + (i / (numPoints - 1)) * (width - 2 * padding);
    const x = baseX + (random() - 0.5) * 40;
    const y = height / 2 + (random() - 0.5) * 100;

    // Size influenced by contributions if available
    let size = 2 + random() * 3;
    if (contributions && contributions[i % contributions.length]) {
      const contrib = contributions[i % contributions.length].contributionCount;
      size = 2 + Math.min(contrib / 3, 4) + random() * 2;
    }

    const opacity = 0.5 + random() * 0.4;
    points.push({ x, y, size, opacity });
  }

  // Generate connections (each point connects to 1-2 nearby points)
  const connections = [];
  for (let i = 0; i < points.length - 1; i++) {
    // Always connect to next point
    connections.push({ from: i, to: i + 1 });

    // Sometimes connect to point after next
    if (i < points.length - 2 && random() > 0.6) {
      connections.push({ from: i, to: i + 2 });
    }
  }

  // Add a few cross-connections for visual interest
  for (let i = 0; i < 2; i++) {
    const from = Math.floor(random() * (points.length - 3));
    const to = from + 2 + Math.floor(random() * 2);
    if (to < points.length) {
      connections.push({ from, to });
    }
  }

  return { points, connections };
}

function generateSVG(constellation, random) {
  const { points, connections } = constellation;

  // Generate connection lines
  const lines = connections.map(({ from, to }) => {
    const p1 = points[from];
    const p2 = points[to];
    return `      <line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"/>`;
  }).join('\n');

  // Generate points with SMIL animations for twinkling
  const circles = points.map((p, i) => {
    const dur = (5 + random() * 6).toFixed(1);
    const begin = (random() * 5).toFixed(1);
    const minOpacity = (p.opacity * 0.35).toFixed(2);
    const maxOpacity = p.opacity.toFixed(2);

    return `      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.size.toFixed(1)}" fill="#58a6ff" opacity="${maxOpacity}">
        <animate attributeName="opacity" values="${maxOpacity};${minOpacity};${maxOpacity}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
      </circle>`;
  }).join('\n');

  // Generate enhanced glows for ALL points (inner + outer glow layers)
  const glows = points.map((p, i) => {
    const dur = (6 + random() * 4).toFixed(1);
    const begin = (random() * 4).toFixed(1);
    const innerRadius = (p.size * 3).toFixed(1);
    const outerRadius = (p.size * 6).toFixed(1);

    return `      <!-- Glow for point ${i} -->
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${outerRadius}" fill="#58a6ff" opacity="0.04" filter="url(#glow)">
        <animate attributeName="opacity" values="0.04;0.10;0.04" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
      </circle>
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${innerRadius}" fill="#58a6ff" opacity="0.12" filter="url(#glow)">
        <animate attributeName="opacity" values="0.12;0.25;0.12" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
      </circle>`;
  }).join('\n');

  return `<svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="800" height="200" fill="transparent"/>

  <!-- Floating constellation group -->
  <g>
    <animateTransform attributeName="transform" type="translate" values="0,0; 3,2; 0,0; -3,-2; 0,0" dur="20s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"/>

    <!-- Glows layer -->
    <g>
${glows}
    </g>

    <!-- Constellation lines -->
    <g stroke="#58a6ff" stroke-width="0.5" opacity="0.3">
${lines}
    </g>

    <!-- Constellation points -->
    <g>
${circles}
    </g>
  </g>
</svg>`;
}

async function main() {
  console.log('Fetching GitHub contributions...');
  const contributions = await fetchContributions();

  if (contributions) {
    console.log(`Got ${contributions.length} days of contribution data`);
  } else {
    console.log('Using date-based seed (no contribution data)');
  }

  // Create seed from today's date + contribution data
  const today = new Date();
  let seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  if (contributions) {
    seed += contributions.reduce((sum, day) => sum + day.contributionCount, 0);
  }

  const random = seededRandom(seed);

  console.log('Generating constellation...');
  const constellation = generateConstellation(contributions, random);

  console.log(`Created ${constellation.points.length} points with ${constellation.connections.length} connections`);

  const svg = generateSVG(constellation, random);
  fs.writeFileSync(OUTPUT_PATH, svg);

  console.log(`Saved to ${OUTPUT_PATH}`);
}

main().catch(console.error);
