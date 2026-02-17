const fs = require("fs")
const path = require("path")
const { ApifyClient } = require("apify-client")

const envPath = path.join(process.cwd(), ".env.local")
const env = fs.readFileSync(envPath, "utf8")
const line = env.split(/\r?\n/).find((entry) => entry.startsWith("APIFY_API_TOKEN="))
const token = line ? line.split("=").slice(1).join("=").trim() : ""

if (!token) {
  console.error("missing token")
  process.exit(1)
}

const client = new ApifyClient({ token })
const leadActorId = "pipelinelabs/lead-scraper-apollo-zoominfo-lusha-ppe"
const linkedinPostActorId = "supreme_coder/linkedin-post"

function generateEmail({ fullName, orgName, position, postCount }) {
  const safeName = fullName || "there"
  const safeCompany = orgName || "your company"
  const safeTitle = position || "your role"
  const postLine =
    postCount > 0
      ? `I noticed your recent ${postCount} LinkedIn post${
          postCount === 1 ? "" : "s"
        } and the themes really stood out.`
      : "I was reviewing your work and thought it aligned with what we do."

  return `Hi ${safeName},

${postLine} I work with teams like ${safeCompany} to source highly targeted B2B leads and automate personalization without adding manual work for your team.

If it helps, I can share a quick sample list tailored to ${safeTitle} targets in your market. Open to a short chat this week?

Best,
`
}

async function main() {
  const outputPath = path.join(process.cwd(), "scripts", "sample-output.json")
  const input = {
    totalResults: 5,
    hasEmail: false,
    hasPhone: false,
    companyIndustry: ["Food"],
    companyCountry: ["United Kingdom"],
    personTitle: ["Chief Marketing Officer"],
  }

  const run = await client.actor(leadActorId).call(input)
  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ clean: true, limit: 5 })

  const leads = Array.isArray(items) ? items : []
  const leadsWithLinkedin = leads.filter(
    (lead) => lead.linkedinUrl && lead.linkedinUrl.includes("linkedin.com")
  )

  const enriched = []

  for (const lead of leadsWithLinkedin) {
    let postCount = 0
    try {
      const postRun = await client.actor(linkedinPostActorId).call({
        urls: [lead.linkedinUrl],
        limitPerSource: 3,
      })
      const postItems = await client
        .dataset(postRun.defaultDatasetId)
        .listItems({ clean: true, limit: 3 })
      postCount = Array.isArray(postItems.items) ? postItems.items.length : 0
    } catch {
      postCount = 0
    }

    enriched.push({
      fullName: lead.fullName || "",
      email: lead.email || "",
      position: lead.position || "",
      phone: lead.phone || "",
      linkedinUrl: lead.linkedinUrl || "",
      emailStatus: lead.emailStatus || "",
      orgName: lead.orgName || "",
      orgIndustry: lead.orgIndustry || "",
      generatedEmail: generateEmail({
        fullName: lead.fullName || "",
        orgName: lead.orgName || "",
        position: lead.position || "",
        postCount,
      }),
    })

    if (enriched.length >= 5) {
      break
    }
  }

  console.log("totalLeads", enriched.length)
  fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2), "utf8")
  console.log(outputPath)
}

main().catch((error) => {
  console.error("error", error instanceof Error ? error.message : error)
  process.exit(1)
})
