/**
 * Read-only, fail-closed required GitHub check-run verification.
 * This is evidence collection, NOT merge authorization or trusted approval.
 * A production caller must enforce branch rules and recheck at merge time.
 */
export async function verifyRequiredGithubChecks({
  owner, repo, prNumber, requiredChecks, fetchImpl = fetch,
}) {
  const validName = value => typeof value === 'string' && /^[a-zA-Z0-9_.-]+$/.test(value);
  if (!validName(owner) || !validName(repo) ||
      !Number.isSafeInteger(prNumber) || prNumber < 1 ||
      !Array.isArray(requiredChecks) || requiredChecks.length === 0 ||
      !requiredChecks.every(name => typeof name === 'string' && name.trim().length > 0) ||
      new Set(requiredChecks).size !== requiredChecks.length) {
    throw new TypeError('Valid repository, PR number and unique required checks are mandatory');
  }
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const get = async path => {
    const result = await fetchImpl(base + path, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!result.ok) throw new Error(`GitHub API unavailable: ${result.status}`);
    return result.json();
  };
  const prPath = `/pulls/${prNumber}`;
  const initial = await get(prPath);
  const sha = initial.head?.sha;
  if (initial.state !== 'open' || initial.base?.ref !== 'main' ||
      initial.head?.repo?.full_name !== `${owner}/${repo}` ||
      typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error('Unsupported PR target or commit');
  }
  // Pagination is required: GitHub returns at most 100 checks per page.
  const checks = [];
  let total;
  for (let page = 1; page <= 10; page++) {
    const data = await get(`/commits/${sha}/check-runs?per_page=100&page=${page}`);
    if (!Array.isArray(data.check_runs) || !Number.isSafeInteger(data.total_count)) {
      throw new Error('Malformed GitHub checks response');
    }
    if (total === undefined) total = data.total_count;
    else if (total !== data.total_count) throw new Error('Checks changed while paginating');
    checks.push(...data.check_runs);
    if (checks.length >= total) break;
    if (data.check_runs.length !== 100) throw new Error('Incomplete GitHub checks pagination');
  }
  if (checks.length !== total) throw new Error('Too many or incomplete GitHub checks');
  const matched = [];
  for (const name of requiredChecks) {
    const candidates = checks.filter(c => c.name === name &&
      c.app?.slug === 'github-actions' &&
      c.head_sha === sha);
    // A duplicated check name is ambiguous and must not be silently accepted.
    if (candidates.length !== 1 ||
        candidates[0].status !== 'completed' ||
        candidates[0].conclusion !== 'success' ||
        !Number.isSafeInteger(candidates[0].id) ||
        !candidates[0].html_url?.startsWith(`https://github.com/${owner}/${repo}/actions/runs/`)) {
      return Object.freeze({ verified: false, headSha: sha, evidence: null,
        missingOrFailed: Object.freeze([...requiredChecks.filter(n => !matched.includes(n))]) });
    }
    matched.push(name);
  }
  // Re-read the PR after collecting checks. This mitigates (but cannot eliminate)
  // a head change during verification.
  const latest = await get(prPath);
  if (latest.head?.sha !== sha || latest.state !== 'open') {
    return Object.freeze({ verified: false, headSha: sha, evidence: null,
      missingOrFailed: Object.freeze(['STALE_HEAD']) });
  }
  return Object.freeze({
    verified: true,
    headSha: sha,
    requiredChecks: Object.freeze([...requiredChecks]),
    evidence: Object.freeze({
      kind: 'ci-passed',
      reference: matched.map(name => checks.find(c => c.name === name && c.head_sha === sha).html_url).join(' '),
    }),
  });
}
