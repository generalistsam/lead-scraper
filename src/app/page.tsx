"use client"

import { useMemo, useState } from "react"
import { Download, Mail, X } from "lucide-react"
import Papa from "papaparse"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type LeadResult = {
  fullName: string
  position: string
  orgName: string
  orgIndustry: string
  email: string
  emailStatus: string
  phone: string
  linkedinUrl: string
  generatedEmail: string
  posts: string[]
}

const industryOptions = [
  "Accounting",
  "Software",
  "Real Estate",
  "Marketing",
  "Logistics & Supply Chain",
  "Financial Services",
  "Healthcare",
  "Education",
  "Manufacturing",
  "Construction",
  "Legal",
  "Consulting",
  "Retail",
  "Hospitality",
]

const companySizeOptions = ["1-10", "11-50", "51-200", "201-500", "500+"]

export default function Home() {
  const [industry, setIndustry] = useState("")
  const [location, setLocation] = useState("")
  const [targetTitles, setTargetTitles] = useState<string[]>([])
  const [titleInput, setTitleInput] = useState("")
  const [companyKeywords, setCompanyKeywords] = useState("")
  const [companySize, setCompanySize] = useState("")
  const [emailStatus, setEmailStatus] = useState("All")
  const [mustHaveEmail, setMustHaveEmail] = useState(false)
  const [mustHavePhone, setMustHavePhone] = useState(false)
  const [maxResults, setMaxResults] = useState(10)
  const [results, setResults] = useState<LeadResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [emailPreview, setEmailPreview] = useState("")
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false)
  const [postsPreviewOpen, setPostsPreviewOpen] = useState(false)
  const [postsPreview, setPostsPreview] = useState<string[]>([])

  const hasResults = results.length > 0

  const csvData = useMemo(() => {
    if (!hasResults) return ""
    return Papa.unparse(
      results.map((lead) => ({
        Name: lead.fullName,
        Title: lead.position,
        Company: lead.orgName,
        Industry: lead.orgIndustry,
        Email: lead.email,
        EmailStatus: lead.emailStatus,
        Phone: lead.phone,
        LinkedIn: lead.linkedinUrl,
        GeneratedEmail: lead.generatedEmail,
      }))
    )
  }, [hasResults, results])

  const addTitle = (value: string) => {
    const cleaned = value.trim()
    if (!cleaned) return
    if (targetTitles.includes(cleaned)) {
      setTitleInput("")
      return
    }
    setTargetTitles((prev) => [...prev, cleaned])
    setTitleInput("")
  }

  const removeTitle = (value: string) => {
    setTargetTitles((prev) => prev.filter((title) => title !== value))
  }

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addTitle(titleInput)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await fetch("/api/run-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          industry,
          location,
          targetTitles,
          companyKeywords,
          companySize,
          emailStatus,
          mustHaveEmail,
          mustHavePhone,
          maxResults,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to run search")
      }

      setResults(data.leads || [])
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to run search"
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = () => {
    if (!csvData) return
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "lead-factory-results.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-muted/20 px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Lead Factory Dashboard
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Search & Filter B2B Leads
          </h1>
          <p className="text-muted-foreground">
            Run targeted searches, enrich LinkedIn activity, and generate
            personalized cold emails.
          </p>
        </header>

        <section className="rounded-2xl border bg-background p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="industry">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industryOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="City or region"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="titles">Target Job Titles</Label>
                <Input
                  id="titles"
                  placeholder="Add a title and press Enter"
                  value={titleInput}
                  onChange={(event) => setTitleInput(event.target.value)}
                  onKeyDown={handleTitleKeyDown}
                />
                {targetTitles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {targetTitles.map((title) => (
                      <Badge key={title} variant="secondary">
                        {title}
                        <button
                          type="button"
                          className="ml-2 inline-flex items-center"
                          onClick={() => removeTitle(title)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4">
              <div className="grid gap-2">
                <Label htmlFor="max-results">Max Results</Label>
                <Input
                  id="max-results"
                  type="number"
                  min={1}
                  value={maxResults}
                  onChange={(event) =>
                    setMaxResults(Number(event.target.value))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="must-email">Must Have Email</Label>
                <Switch
                  id="must-email"
                  checked={mustHaveEmail}
                  onCheckedChange={setMustHaveEmail}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="must-phone">Must Have Phone</Label>
                <Switch
                  id="must-phone"
                  checked={mustHavePhone}
                  onCheckedChange={setMustHavePhone}
                />
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Advanced Filters</Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Advanced Filters</SheetTitle>
                  </SheetHeader>
                  <div className="grid gap-5 p-4">
                    <div className="grid gap-2">
                      <Label htmlFor="keywords">Company Keywords</Label>
                      <Input
                        id="keywords"
                        placeholder="AI, automation, fintech"
                        value={companyKeywords}
                        onChange={(event) =>
                          setCompanyKeywords(event.target.value)
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="company-size">Company Size</Label>
                      <Select
                        value={companySize}
                        onValueChange={setCompanySize}
                      >
                        <SelectTrigger id="company-size">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {companySizeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="email-status">Email Status</Label>
                      <Select
                        value={emailStatus}
                        onValueChange={setEmailStatus}
                      >
                        <SelectTrigger id="email-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Verified">Verified</SelectItem>
                          <SelectItem value="Unverified">Unverified</SelectItem>
                          <SelectItem value="All">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Finding leads..." : "Find Leads"}
              </Button>
              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-background p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Lead Results
              </h2>
              <p className="text-sm text-muted-foreground">
                {hasResults
                  ? `${results.length} leads returned`
                  : "Run a search to see enriched leads"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={!hasResults}
            >
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </div>

          <div className="mt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Posts</TableHead>
                  <TableHead>Generated Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((lead) => (
                  <TableRow key={`${lead.fullName}-${lead.email}`}>
                    <TableCell className="font-medium">
                      {lead.fullName || "—"}
                    </TableCell>
                    <TableCell>{lead.position || "—"}</TableCell>
                    <TableCell>{lead.orgName || "—"}</TableCell>
                    <TableCell>{lead.orgIndustry || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <span>{lead.email || "—"}</span>
                        {lead.emailStatus && (
                          <Badge
                            variant={
                              lead.emailStatus === "Verified"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {lead.emailStatus}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{lead.phone || "—"}</TableCell>
                    <TableCell>
                      {lead.linkedinUrl ? (
                        <a
                          href={lead.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          Profile
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <span>
                          {lead.posts && lead.posts.length > 0
                            ? `${lead.posts[0].slice(0, 80)}${
                                lead.posts[0].length > 80 ? "…" : ""
                              }`
                            : "None"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPostsPreview(lead.posts || [])
                            setPostsPreviewOpen(true)
                          }}
                          disabled={!lead.posts || lead.posts.length === 0}
                        >
                          View Posts
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEmailPreview(lead.generatedEmail)
                          setEmailPreviewOpen(true)
                        }}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        View Generated Email
                      </Button>
                      <a
                        href={`mailto:${encodeURIComponent(
                          lead.email || ""
                        )}?subject=${encodeURIComponent(
                          "Quick introduction"
                        )}&body=${encodeURIComponent(lead.generatedEmail || "")}`}
                        className="ml-2 inline-flex"
                      >
                        <Button variant="default" size="sm" disabled={!lead.email}>
                          Send Email
                        </Button>
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
                {!hasResults && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      No results yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <Sheet open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Generated Email</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <Textarea
              value={emailPreview || "No email generated yet."}
              readOnly
              className="min-h-[240px]"
            />
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={postsPreviewOpen} onOpenChange={setPostsPreviewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Posts</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            {postsPreview && postsPreview.length > 0 ? (
              <div className="space-y-4">
                {postsPreview.map((p, i) => (
                  <Textarea key={i} value={p} readOnly className="min-h-[120px]" />
                ))}
              </div>
            ) : (
              <Textarea value="None" readOnly className="min-h-[120px]" />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
