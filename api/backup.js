const GITHUB_API = 'https://api.github.com';
const MAX_BACKUP_BYTES = 4 * 1024 * 1024;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isSameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

async function readJsonBody(request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BACKUP_BYTES) return { error: '요청 파일이 너무 큽니다.' };
  try { return { value: JSON.parse(raw) }; }
  catch { return { error: 'JSON 형식의 요청이 아닙니다.' }; }
}

function githubTarget() {
  const [owner, repo, extra] = (process.env.GITHUB_REPOSITORY || '').split('/');
  const branch = process.env.GITHUB_BRANCH || 'main';
  const path = process.env.GITHUB_BACKUP_PATH || 'data/shared-data.json';
  if (!owner || !repo || extra || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error('GITHUB_REPOSITORY를 owner/repository 형식으로 설정해 주세요.');
  }
  const segments = path.split('/');
  if (!path || path.startsWith('/') || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('GITHUB_BACKUP_PATH 경로 설정을 확인해 주세요.');
  }
  return { owner, repo, branch, path, encodedPath: segments.map(encodeURIComponent).join('/') };
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_BACKUP_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  let body = {};
  try { body = await response.json(); } catch {}
  return { response, body };
}

export async function PUT(request) {
  if (!isSameOrigin(request)) return jsonResponse({ error: '허용되지 않은 요청입니다.' }, 403);
  if (!process.env.GITHUB_BACKUP_TOKEN) {
    return jsonResponse({ error: 'Vercel에 GitHub 백업 토큰을 설정해 주세요.' }, 503);
  }

  const body = await readJsonBody(request);
  if (body.error) return jsonResponse({ error: body.error }, 400);
  const backup = body.value?.data;
  if (!backup || typeof backup !== 'object' || !Array.isArray(backup.sites)) {
    return jsonResponse({ error: '백업 자료에서 현장 목록을 찾지 못했습니다.' }, 400);
  }

  let target;
  let serialized;
  try {
    target = githubTarget();
    serialized = JSON.stringify(backup, null, 2);
  } catch (error) {
    return jsonResponse({ error: error.message }, 503);
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BACKUP_BYTES) {
    return jsonResponse({ error: 'GitHub 백업 파일이 4MB를 초과했습니다.' }, 413);
  }

  const fileUrl = `${GITHUB_API}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${target.encodedPath}`;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const lookup = await githubRequest(`${fileUrl}?ref=${encodeURIComponent(target.branch)}`);
      let sha;
      if (lookup.response.ok) sha = lookup.body.sha;
      else if (lookup.response.status !== 404) {
        console.error('GitHub backup lookup failed:', lookup.response.status, lookup.body.message);
        return jsonResponse({ error: 'GitHub 저장소를 확인하지 못했습니다. 토큰 권한·저장소·브랜치를 확인해 주세요.' }, 502);
      }

      const update = await githubRequest(fileUrl, {
        method: 'PUT',
        body: JSON.stringify({
          message: `TS 공사관리 데이터 백업 ${new Date().toISOString()}`,
          content: Buffer.from(serialized, 'utf8').toString('base64'),
          branch: target.branch,
          ...(sha ? { sha } : {}),
        }),
      });
      if (update.response.ok) {
        return jsonResponse({
          saved: true,
          path: target.path,
          commitUrl: update.body.commit?.html_url || null,
        });
      }
      if (update.response.status === 409 && attempt < 2) continue;
      console.error('GitHub backup write failed:', update.response.status, update.body.message);
      return jsonResponse({ error: 'GitHub 파일 저장에 실패했습니다. 토큰 권한과 기본 브랜치를 확인해 주세요.' }, 502);
    }
  } catch (error) {
    console.error('GitHub backup request failed:', error);
    return jsonResponse({ error: 'GitHub에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
  }
  return jsonResponse({ error: '다른 백업 요청과 충돌했습니다. 다시 눌러 주세요.' }, 409);
}
