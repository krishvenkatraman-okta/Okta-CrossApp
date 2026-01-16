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
    const baseBranch = "main"
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)
    const newBranch = `demo/pam-vault-${timestamp}`
    const steps: string[] = []

    console.log("[v0] GitHub PR Creation Flow")
    console.log("[v0] ========================")
    console.log("[v0] Repository:", GITHUB_REPO)
    console.log("[v0] PAT: github_pat_***") // Security: redacted

    // Step 2.2: Validate token and repo access
    steps.push("Validating GitHub token...")

    // Validate user access
    const userResponse = await fetch("https://api.github.com/user", {
      headers: getGitHubHeaders(pat),
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error("[v0] User validation failed:", userResponse.status)
      return NextResponse.json(
        {
          error: "GitHub PAT validation failed",
          details: errorText,
          step: "validate_user",
        },
        { status: 401 },
      )
    }

    const userData = await userResponse.json()
    steps.push(`  Token validated for user: ${userData.login}`)
    console.log("[v0] Token validated for user:", userData.login)

    // Validate repo access
    steps.push("Validating repository access...")

    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: getGitHubHeaders(pat),
    })

    if (!repoResponse.ok) {
      const errorText = await repoResponse.text()
      console.error("[v0] Repo access failed:", repoResponse.status)
      if (repoResponse.status === 404) {
        return NextResponse.json(
          {
            error: "Repository not accessible",
            details:
              "PAT doesn't have access to this private repo. Check fine-grained PAT repo selection or org authorization.",
            step: "validate_repo",
          },
          { status: 404 },
        )
      }
      return NextResponse.json(
        {
          error: "Repository access failed",
          details: errorText,
          step: "validate_repo",
        },
        { status: repoResponse.status },
      )
    }

    const repoData = await repoResponse.json()
    steps.push(`  Repository access verified: ${repoData.full_name}`)
    console.log("[v0] Repository access verified:", repoData.full_name)

    // Step 2.3A: Get base SHA
    steps.push(`Getting base SHA from ${baseBranch} branch...`)

    const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, {
      headers: getGitHubHeaders(pat),
    })

    if (!refResponse.ok) {
      const errorText = await refResponse.text()
      console.error("[v0] Get base SHA failed:", refResponse.status)
      return NextResponse.json(
        {
          error: "Failed to get base branch SHA",
          details: errorText,
          step: "get_base_sha",
        },
        { status: refResponse.status },
      )
    }

    const refData = await refResponse.json()
    const baseSha = refData.object.sha
    steps.push(`  Base SHA: ${baseSha.substring(0, 7)}...`)
    console.log("[v0] Base SHA:", baseSha.substring(0, 7))

    // Step 2.3B: Create new branch
    steps.push(`Creating branch: ${newBranch}...`)

    const createBranchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: getGitHubHeaders(pat),
      body: JSON.stringify({
        ref: `refs/heads/${newBranch}`,
        sha: baseSha,
      }),
    })

    if (!createBranchResponse.ok) {
      const errorText = await createBranchResponse.text()
      console.error("[v0] Create branch failed:", createBranchResponse.status)
      return NextResponse.json(
        {
          error: "Failed to create branch",
          details: errorText,
          step: "create_branch",
        },
        { status: createBranchResponse.status },
      )
    }

    steps.push(`  Branch created successfully`)
    console.log("[v0] Branch created:", newBranch)

    // Step 2.3C: Read README.md
    steps.push("Reading README.md...")

    const readmeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/README.md?ref=${newBranch}`,
      { headers: getGitHubHeaders(pat) },
    )

    if (!readmeResponse.ok) {
      const errorText = await readmeResponse.text()
      console.error("[v0] Read README failed:", readmeResponse.status)
      return NextResponse.json(
        {
          error: "Failed to read README.md",
          details: errorText,
          step: "read_readme",
        },
        { status: readmeResponse.status },
      )
    }

    const readmeData = await readmeResponse.json()
    const fileSha = readmeData.sha
    const contentB64 = readmeData.content
    const currentContent = Buffer.from(contentB64, "base64").toString("utf-8")
    steps.push(`  README.md read (${currentContent.length} bytes)`)
    console.log("[v0] README read, length:", currentContent.length)

    // Step 2.3D: Modify README
    const isoTimestamp = new Date().toISOString()
    const newLine = `\nLast demo run: ${isoTimestamp} (Okta PAM vaulted-secret token-exchange)\n`
    const updatedContent = currentContent + newLine
    const updatedContentB64 = Buffer.from(updatedContent).toString("base64")
    steps.push("Modifying README.md...")

    // Step 2.3E: Commit README update
    steps.push("Committing README update...")

    const updateResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/README.md`, {
      method: "PUT",
      headers: getGitHubHeaders(pat),
      body: JSON.stringify({
        message: "Demo: README update via Okta PAM vaulted-secret token exchange",
        content: updatedContentB64,
        sha: fileSha,
        branch: newBranch,
      }),
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      console.error("[v0] Commit failed:", updateResponse.status)
      return NextResponse.json(
        {
          error: "Failed to commit README update",
          details: errorText,
          step: "commit_readme",
        },
        { status: updateResponse.status },
      )
    }

    steps.push(`  Committed to ${newBranch}`)
    console.log("[v0] README committed")

    // Step 2.3F: Create PR
    steps.push("Creating Pull Request...")

    const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: getGitHubHeaders(pat),
      body: JSON.stringify({
        title: "Demo: README update (Okta PAM vaulted-secret)",
        head: newBranch,
        base: baseBranch,
        body: "Created by AI agent. GitHub PAT retrieved at runtime from Okta PAM using token-exchange (requested_token_type=vaulted-secret).",
      }),
    })

    if (!prResponse.ok) {
      const errorText = await prResponse.text()
      console.error("[v0] Create PR failed:", prResponse.status)
      return NextResponse.json(
        {
          error: "Failed to create PR",
          details: errorText,
          step: "create_pr",
        },
        { status: prResponse.status },
      )
    }

    const prData = await prResponse.json()
    steps.push(`  PR created: ${prData.html_url}`)
    console.log("[v0] PR created:", prData.html_url)

    return NextResponse.json({
      success: true,
      prUrl: prData.html_url,
      prNumber: prData.number,
      branch: newBranch,
      steps,
      user: userData.login,
      repo: repoData.full_name,
    })
  } catch (error) {
    console.error("[v0] GitHub PR creation error:", error instanceof Error ? error.message : "Unknown")
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
