const axios = require('axios');
const config = require('./config');
const { jarvis } = require('./ui');
const { withRetry } = require('./retry');

const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    'Authorization': `Bearer ${config.github.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

/**
 * Create a new branch from base branch
 */
async function createBranch(branchName, baseBranch = 'main') {
  return withRetry(async () => {
    // Get base branch SHA
    const baseRef = await githubApi.get(
      `/repos/${config.github.owner}/${config.github.repo}/git/refs/heads/${baseBranch}`
    );

    const baseSha = baseRef.data.object.sha;

    // Create new branch
    await githubApi.post(
      `/repos/${config.github.owner}/${config.github.repo}/git/refs`,
      {
        ref: `refs/heads/${branchName}`,
        sha: baseSha
      }
    );

    return { branch: branchName, sha: baseSha };
  }, { maxAttempts: 3 });
}

/**
 * Merge source branch into target branch
 */
async function mergeBranch(sourceBranch, targetBranch, commitMessage) {
  return withRetry(async () => {
    const response = await githubApi.post(
      `/repos/${config.github.owner}/${config.github.repo}/merges`,
      {
        base: targetBranch,
        head: sourceBranch,
        commit_message: commitMessage || `Merge ${sourceBranch} into ${targetBranch}`
      }
    );

    return response.data;
  }, { maxAttempts: 3 });
}

/**
 * Create a pull request
 */
async function createPR(title, body, headBranch, baseBranch = 'main') {
  return withRetry(async () => {
    const response = await githubApi.post(
      `/repos/${config.github.owner}/${config.github.repo}/pulls`,
      {
        title,
        body,
        head: headBranch,
        base: baseBranch
      }
    );

    return {
      number: response.data.number,
      url: response.data.html_url,
      branch: headBranch
    };
  }, { maxAttempts: 3 });
}

/**
 * Get pull request by branch name
 */
async function getPRByBranch(branchName) {
  return withRetry(async () => {
    const response = await githubApi.get(
      `/repos/${config.github.owner}/${config.github.repo}/pulls`,
      {
        params: {
          head: `${config.github.owner}:${branchName}`,
          state: 'all'
        }
      }
    );

    if (response.data && response.data.length > 0) {
      const pr = response.data[0];
      return {
        found: true,
        number: pr.number,
        url: pr.html_url,
        state: pr.state
      };
    }

    return { found: false };
  }, { maxAttempts: 2 });
}

/**
 * Delete a branch
 */
async function deleteBranch(branchName) {
  return withRetry(async () => {
    await githubApi.delete(
      `/repos/${config.github.owner}/${config.github.repo}/git/refs/heads/${branchName}`
    );

    return { deleted: true, branch: branchName };
  }, { maxAttempts: 2 });
}

/**
 * Check if branch exists
 */
async function branchExists(branchName) {
  try {
    await githubApi.get(
      `/repos/${config.github.owner}/${config.github.repo}/git/refs/heads/${branchName}`
    );
    return true;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get branch commit SHA
 */
async function getBranchSHA(branchName) {
  return withRetry(async () => {
    const response = await githubApi.get(
      `/repos/${config.github.owner}/${config.github.repo}/git/refs/heads/${branchName}`
    );

    return response.data.object.sha;
  }, { maxAttempts: 2 });
}

/**
 * Add comment to PR
 */
async function addPRComment(prNumber, comment) {
  return withRetry(async () => {
    await githubApi.post(
      `/repos/${config.github.owner}/${config.github.repo}/issues/${prNumber}/comments`,
      { body: comment }
    );

    return { success: true };
  }, { maxAttempts: 3 });
}

module.exports = {
  createBranch,
  mergeBranch,
  createPR,
  getPRByBranch,
  deleteBranch,
  branchExists,
  getBranchSHA,
  addPRComment
};
