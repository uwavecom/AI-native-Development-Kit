/**
 * Read-only GitHub Actions evidence resolver for a public-repository pilot.
 * Never grants approval or invokes a merge. GitHub API results are untrusted
 * until correlated to the exact PR head commit and completed workflow run.
 */
export async function verifyGithubPrCi({ owner, repo, prNumber, fetchImpl = fetch }) {
  if (![owner, repo].every(x => /^[a-zA-Z0-9_.-]+$/.test(x)) ||
      !Number.isSafeInteger(prNumber) || prNumber < 1) {
    throw new TypeError('Valid owner, repo and positive PR number required');
  }
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const getJson = async (path) => {
    const response = await fetchImpl(base + path, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
    return response.json();
  };
  const pr = await getJson(`/pulls/${prNumber}`);
  if (pr.head?.repo?.full_name !== `${owner}/${repo}` ||
      typeof pr.head?.sha !== 'string' || !/^[a-f0-9]{40}$/.test(pr.head.sha) ||
      !pr.head.ref || pr.base?.ref !== 'main' || pr.state !== 'open') {
    throw new Error('Unsupported PR identity or target');
  }
  const runs = await getJson(`/actions/runs?head_sha=${pr.head.sha}&per_page=100`);
  const matched = (runs.workflow_runs ?? []).filter(run =>
    run.event === 'pull_request' &&
    run.head_sha === pr.head.sha &&
    run.head_branch === pr.head.ref &&
    run.status === 'completed' &&
    run.conclusion === 'success' &&
    run.repository?.full_name === `${owner}/${repo}` &&
    typeof run.html_url === 'string' &&
    run.html_url.startsWith(`https://github.com/${owner}/${repo}/actions/runs/`)
  );
  if (matched.length === 0) {
    return Object.freeze({ verified: false, headSha: pr.head.sha, evidence: null });
  }
  const selected = matched[0];
  return Object.freeze({
    verified: true,
    headSha: pr.head.sha,
    evidence: Object.freeze({ kind: 'ci-passed', reference: selected.html_url }),
  });
}
