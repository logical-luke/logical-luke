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
function generateConstellation(contributions) {
  const width = 800;
  const height = 200;
  const padding = 60;

  // Create seed from today's date + contribution data
  const today = new Date();
  let seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  if (contributions) {
    seed += contributions.reduce((sum, day) => sum + day.contributionCount, 0);
  }

  const random = seededRandom(seed);

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

function generateSVG(constellation) {
  const { points, connections } = constellation;

  // Generate connection lines
  const lines = connections.map(({ from, to }) => {
    const p1 = points[from];
    const p2 = points[to];
    return `    <line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"/>`;
  }).join('\n');

  // Generate points
  const circles = points.map(p =>
    `    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.size.toFixed(1)}" opacity="${p.opacity.toFixed(2)}"/>`
  ).join('\n');

  // Generate subtle glows for larger points
  const glows = points
    .filter(p => p.size > 3.5)
    .map(p => `    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.size * 4).toFixed(1)}"/>`)
    .join('\n');

  return `<svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="800" height="200" fill="transparent"/>

  <!-- Constellation lines -->
  <g stroke="#58a6ff" stroke-width="0.5" opacity="0.3">
${lines}
  </g>

  <!-- Constellation points -->
  <g fill="#58a6ff">
${circles}
  </g>

  <!-- Subtle glows -->
  <g fill="#58a6ff" opacity="0.08">
${glows}
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

  console.log('Generating constellation...');
  const constellation = generateConstellation(contributions);

  console.log(`Created ${constellation.points.length} points with ${constellation.connections.length} connections`);

  const svg = generateSVG(constellation);
  fs.writeFileSync(OUTPUT_PATH, svg);

  console.log(`Saved to ${OUTPUT_PATH}`);
}

main().catch(console.error);
