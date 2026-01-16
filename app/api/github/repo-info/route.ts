import { type NextRequest, NextResponse } from "next/server"

const GITHUB_REPO = process.env.GITHUB_REPO || "krishvenkatraman-okta/01-sample"
const GITHUB_API_VERSION = "2022-11-28"

function getGitHubHeaders(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "Okta-CrossApp-Demo",
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pat } = await request.json()

    if (!pat) {
      return NextResponse.json({ error: "Missing GitHub PAT" }, { status: 400 })
    }

    const [owner, repo] = GITHUB_REPO.split("/")
    const steps: string[] = []

    console.log("[v0] GitHub Repo Info Request")
    console.log("[v0] =========================")
    console.log("[v0] Repository:", GITHUB_REPO)
    console.log("[v0] PAT: github_pat_***") // Security: redacted

    // Step 2.2: Validate token
    steps.push("Validating GitHub token...")

    const userResponse = await fetch("https://api.github.com/user", {
      headers: getGitHubHeaders(pat),
    })

    if (!userResponse.ok) {
      console.error("[v0] User validation failed:", userResponse.status)
      return NextResponse.json(
        {
          error: "GitHub PAT validation failed",
          step: "validate_user",
        },
        { status: 401 },
      )
    }

    const userData = await userResponse.json()
    steps.push(`  Token validated for user: ${userData.login}`)

    // Validate repo access
    steps.push("Validating repository access...")

    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: getGitHubHeaders(pat),
    })

    if (!repoResponse.ok) {
      console.error("[v0] Repo access failed:", repoResponse.status)
      if (repoResponse.status === 404) {
        return NextResponse.json(
          {
            error: "Repository not accessible",
            details: "PAT doesn't have access to this private repo",
            step: "validate_repo",
          },
          { status: 404 },
        )
      }
      return NextResponse.json(
        {
          error: "Repository access failed",
          step: "validate_repo",
        },
        { status: repoResponse.status },
      )
    }

    const repoData = await repoResponse.json()
    steps.push(`  Repository access verified: ${repoData.full_name}`)
    console.log("[v0] Repository access verified:", repoData.full_name)

    // Fetch recent commits
    steps.push("Fetching recent commits...")
    let recentCommits: Array<{ message: string; author: string; date: string }> = []

    try {
      const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`, {
        headers: getGitHubHeaders(pat),
      })

      if (commitsResponse.ok) {
        const commitsData = await commitsResponse.json()
        recentCommits = commitsData.map(
          (commit: { commit: { message: string; author: { name: string; date: string } } }) => ({
            message: commit.commit.message,
            author: commit.commit.author.name,
            date: commit.commit.author.date,
          }),
        )
        steps.push(`  Retrieved ${recentCommits.length} recent commits`)
      }
    } catch (commitError) {
      console.warn("[v0] Could not fetch commits")
    }

    return NextResponse.json({
      success: true,
      fullName: repoData.full_name,
      name: repoData.name,
      description: repoData.description,
      private: repoData.private,
      defaultBranch: repoData.default_branch,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      createdAt: repoData.created_at,
      updatedAt: repoData.updated_at,
      htmlUrl: repoData.html_url,
      recentCommits,
      steps,
      user: userData.login,
    })
  } catch (error) {
    console.error("[v0] GitHub API error:", error instanceof Error ? error.message : "Unknown")
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
