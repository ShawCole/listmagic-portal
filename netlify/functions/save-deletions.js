exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const NETLIFY_TOKEN = process.env.NETLIFY_DEPLOY_TOKEN;
  const SITE_ID = process.env.SITE_ID || 'c9afc7de-c565-4a4a-9345-da0ca087fdf9';
  const REPO = 'ShawCole/listmagic-portal';
  const FILE_PATH = 'data/deletions.json';
  const BRANCH = 'main';

  if (!GITHUB_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' }) };
  }

  try {
    const selections = JSON.parse(event.body);

    // Get current file SHA (if it exists) for update
    let sha = null;
    const getResp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'listmagic-portal' }
    });
    if (getResp.ok) {
      const data = await getResp.json();
      sha = data.sha;
    }

    // Commit the file
    const content = Buffer.from(JSON.stringify(selections, null, 2)).toString('base64');
    const commitBody = {
      message: `Update deletion selections (${selections.count || 0} audiences)`,
      content: content,
      branch: BRANCH
    };
    if (sha) commitBody.sha = sha;

    const putResp = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'listmagic-portal',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commitBody)
    });

    if (!putResp.ok) {
      const err = await putResp.text();
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'GitHub commit failed', detail: err }) };
    }

    // Trigger Netlify redeploy
    if (NETLIFY_TOKEN) {
      await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/builds`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: `Saved ${selections.count} selections and triggered redeploy` })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
