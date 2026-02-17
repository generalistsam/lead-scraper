import { ApifyClient } from "apify-client"
import { NextResponse } from "next/server"

type SearchRequest = {
  industry: string
  location: string
  targetTitles: string[]
  companyKeywords: string
  companySize: string
  emailStatus: "Verified" | "Unverified" | "All"
  mustHaveEmail: boolean
  mustHavePhone: boolean
  maxResults: number
}

type LeadItem = {
  fullName?: string
  email?: string
  position?: string
  phone?: string
  linkedinUrl?: string
  emailStatus?: string
  orgName?: string
  orgIndustry?: string
}

type LeadResponse = {
  fullName: string
  email: string
  position: string
  phone: string
  linkedinUrl: string
  emailStatus: string
  orgName: string
  orgIndustry: string
  generatedEmail: string
  posts: string[]
}

const leadActorId = "pipelinelabs/lead-scraper-apollo-zoominfo-lusha-ppe"
const linkedinPostActorId = "supreme_coder/linkedin-post"

function cleanArray(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean)
}

function addIfValue<T extends Record<string, unknown>>(
  target: T,
  key: string,
  value: unknown
) {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return
  }
  target[key] = value
}

async function fetchLinkedinPostCount(
  client: ApifyClient,
  linkedinUrl: string
) {
  try {
    const run = await client.actor(linkedinPostActorId).call({
      urls: [linkedinUrl],
      limitPerSource: 3,
    })
    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ clean: true, limit: 3 })
    return Array.isArray(items) ? items.length : 0
  } catch {
    return 0
  }
}

async function fetchLinkedinPosts(client: ApifyClient, linkedinUrl: string) {
  try {
    const run = await client.actor(linkedinPostActorId).call({
      urls: [linkedinUrl],
      limitPerSource: 3,
    })
    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ clean: true, limit: 3 })
    const posts = Array.isArray(items) ? items : []
    const texts = posts
      .map((p: any) => {
        const t =
          (typeof p.text === "string" && p.text) ||
          (typeof p.content === "string" && p.content) ||
          (typeof p.caption === "string" && p.caption) ||
          (typeof p.description === "string" && p.description) ||
          ""
        return t.trim()
      })
      .filter(Boolean)
    return texts
  } catch {
    return []
  }
}

function generateEmail({
  fullName,
  orgName,
  position,
  posts,
}: {
  fullName: string
  orgName: string
  position: string
  posts: string[]
}) {
  const safeName = fullName || "there"
  const safeCompany = orgName || "your company"
  const safeTitle = position || "your role"
  const firstPost = posts[0] || ""
  const trimmed =
    firstPost.length > 220 ? `${firstPost.slice(0, 220)}…` : firstPost
  const postLine =
    trimmed && trimmed.length > 0
      ? `I read your recent LinkedIn update: "${trimmed}". It resonated with how teams like ${safeCompany} approach ${safeTitle} priorities.`
      : `I was looking at your work at ${safeCompany} and thought there might be a helpful way to support ${safeTitle} goals.`

  return `Hi ${safeName},

${postLine} I work with teams like ${safeCompany} to source highly targeted B2B leads and automate personalization without adding extra manual work.

If it helps, I can share a quick sample list tailored to ${safeTitle} targets in your market. Would you be open to a short chat this week?

Best,
`
}

export async function POST(request: Request) {
  try {
    const apiToken = process.env.APIFY_API_TOKEN
    if (!apiToken) {
      return NextResponse.json(
        { error: "Missing APIFY_API_TOKEN" },
        { status: 400 }
      )
    }

    const rawBody = await request.text()
    let body: SearchRequest
    try {
      body = JSON.parse(rawBody) as SearchRequest
    } catch (error) {
      const trimmed = rawBody.trim()
      const unwrapped =
        trimmed.startsWith("'") && trimmed.endsWith("'")
          ? trimmed.slice(1, -1)
          : trimmed
      const unescaped = unwrapped.replace(/\\"/g, '"')
      try {
        body = JSON.parse(unescaped) as SearchRequest
      } catch (parseError) {
        const message =
          parseError instanceof Error ? parseError.message : "Invalid JSON"
        return NextResponse.json(
          { error: message, rawBody },
          { status: 400 }
        )
      }
    }
    const client = new ApifyClient({ token: apiToken })

    const targetTitles = cleanArray(body.targetTitles || [])
    const maxResults = body.maxResults || 10
    const runInput: Record<string, unknown> = {}

    addIfValue(runInput, "totalResults", maxResults)
    addIfValue(runInput, "hasEmail", body.mustHaveEmail)
    addIfValue(runInput, "hasPhone", body.mustHavePhone)

    if (body.emailStatus && body.emailStatus !== "All") {
      addIfValue(runInput, "contactEmailStatus", [body.emailStatus])
    }

    if (body.industry) {
      addIfValue(runInput, "companyIndustry", [body.industry])
    }

    if (body.location) {
      addIfValue(runInput, "companyCountry", [body.location])
    }

    if (targetTitles.length > 0) {
      addIfValue(runInput, "personTitle", targetTitles)
    }

    if (body.companyKeywords) {
      addIfValue(runInput, "companyKeyword", [body.companyKeywords])
    }

    if (body.companySize) {
      addIfValue(runInput, "companyEmployeeSize", [body.companySize])
    }

    const runSearch = async (input: Record<string, unknown>) => {
      const leadRun = await client.actor(leadActorId).call(input)
      const { items } = await client
        .dataset(leadRun.defaultDatasetId)
        .listItems({
          clean: true,
          limit: maxResults,
        })
      return (Array.isArray(items) ? items : []) as LeadItem[]
    }

    let leads = await runSearch(runInput)

    if (leads.length === 0) {
      const fallbackInput: Record<string, unknown> = {}
      addIfValue(fallbackInput, "totalResults", maxResults)
      addIfValue(fallbackInput, "hasEmail", body.mustHaveEmail)
      addIfValue(fallbackInput, "hasPhone", body.mustHavePhone)
      if (body.emailStatus && body.emailStatus !== "All") {
        addIfValue(fallbackInput, "contactEmailStatus", [body.emailStatus])
      }
      if (body.location) {
        addIfValue(fallbackInput, "companyCountry", [body.location])
      }
      leads = await runSearch(fallbackInput)
    }

    if (leads.length === 0) {
      const minimalInput: Record<string, unknown> = {}
      addIfValue(minimalInput, "totalResults", maxResults)
      addIfValue(minimalInput, "hasEmail", body.mustHaveEmail)
      addIfValue(minimalInput, "hasPhone", body.mustHavePhone)
      if (body.emailStatus && body.emailStatus !== "All") {
        addIfValue(minimalInput, "contactEmailStatus", [body.emailStatus])
      }
      leads = await runSearch(minimalInput)
    }

    const enrichedLeads: LeadResponse[] = []

    for (const lead of leads) {
      const posts =
        lead.linkedinUrl ? await fetchLinkedinPosts(client, lead.linkedinUrl) : []

      const generatedEmail = await generateEmail({
        fullName: lead.fullName || "there",
        orgName: lead.orgName || "your company",
        position: lead.position || "your role",
        posts,
      })

      enrichedLeads.push({
        fullName: lead.fullName || "",
        email: lead.email || "",
        position: lead.position || "",
        phone: lead.phone || "",
        linkedinUrl: lead.linkedinUrl || "",
        emailStatus: lead.emailStatus || "",
        orgName: lead.orgName || "",
        orgIndustry: lead.orgIndustry || "",
        generatedEmail,
        posts,
      })
    }

    return NextResponse.json({ leads: enrichedLeads })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
