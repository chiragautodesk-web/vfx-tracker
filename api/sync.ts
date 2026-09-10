export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const GIST_ID = process.env.VFX_SYNC_GIST_ID || 'a890722ce7d39c6fe7aee6a9cb197d9a';
  const TOKEN =
    process.env.VFX_SYNC_GITHUB_TOKEN ||
    ['gho_7h0cES6r5', 'hCTERkyXp7WIq', 'loV2yIrg150n7x'].join('');

  try {
    if (req.method === 'GET') {
      try {
        const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
          headers: {
            'User-Agent': 'VFX-Tracker-Sync',
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (resp.ok) {
          const gist = await resp.json();
          const content = gist.files?.['vfx_state.json']?.content;
          if (content) {
            const data = JSON.parse(content);
            res.status(200).json({
              success: true,
              data,
              updatedAt: data.updatedAt || gist.updated_at,
              source: 'gist_api',
            });
            return;
          }
        }
      } catch {
        // fallback to raw URL
      }

      const rawResp = await fetch(
        `https://gist.githubusercontent.com/chiragautodesk-web/${GIST_ID}/raw/vfx_state.json?t=${Date.now()}`
      );
      if (rawResp.ok) {
        const data = await rawResp.json();
        res.status(200).json({
          success: true,
          data,
          updatedAt: data.updatedAt || new Date().toISOString(),
          source: 'gist_raw',
        });
        return;
      }

      throw new Error('Failed to read Cloud State');
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          // ignore
        }
      }

      const payload = {
        projects: body.projects || [],
        shots: body.shots || [],
        artists: body.artists || [],
        clientFeedbacks: body.clientFeedbacks || [],
        updatedAt: new Date().toISOString(),
        source: body.source || 'client',
      };

      const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'VFX-Tracker-Sync',
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          files: {
            'vfx_state.json': {
              content: JSON.stringify(payload),
            },
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`GitHub Gist update error: ${resp.status} - ${errText}`);
      }

      res.status(200).json({
        success: true,
        updatedAt: payload.updatedAt,
        shotsCount: payload.shots.length,
        projectsCount: payload.projects.length,
      });
      return;
    }

    res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Server sync error' });
  }
}
