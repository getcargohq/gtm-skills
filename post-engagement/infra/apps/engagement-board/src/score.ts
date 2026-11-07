import { AUTHORS, type Author, ICP, SCORING } from "./config";

export {
  ADJACENT_LABEL,
  DATASET,
  HAS_ADJACENT,
  MODELS,
  SCORING,
  type Author,
} from "./config";

// Storage SQL returns at most 10,000 rows and says nothing when it stops there.
export const PAGE = 5000;

// FIELD MEANINGS
// detected: last_signal_date, the day Cargo Signals saw the engagement. Rows
// arrive in sweeps roughly every eight days, so it trails the real engagement.
// post_date: when the post went up, not when the person engaged with it.
// tracked: the profile whose post was engaged with, with a miniProfileUrn query.
export const SELECT = `
  _id AS id,
  JSON_VALUE(contact, '$.linkedin_profile_url') AS person_url,
  JSON_VALUE(contact, '$.first_name') AS first_name,
  JSON_VALUE(contact, '$.last_name') AS last_name,
  JSON_VALUE(contact, '$.title') AS title,
  JSON_VALUE(contact, '$.location') AS location,
  JSON_VALUE(company, '$.name') AS company_name,
  JSON_VALUE(company, '$.linkedin_url') AS company_url,
  JSON_VALUE(company, '$.website') AS website,
  JSON_VALUE(company, '$.employee_range') AS employee_range,
  JSON_VALUE(company, '$.industry') AS industry,
  JSON_VALUE(data, '$.engagement_type') AS engagement_type,
  JSON_VALUE(data, '$.post_url') AS post_url,
  JSON_VALUE(data, '$.post_date') AS post_date,
  SUBSTR(JSON_VALUE(data, '$.post_content'), 1, 240) AS post_excerpt,
  JSON_VALUE(data, '$.mention_content') AS comment,
  JSON_VALUE(data, '$.tracked_contact') AS tracked,
  FORMAT_DATE('%Y-%m-%d', DATE(last_signal_date)) AS detected`;

export const WHERE = `JSON_VALUE(data, '$.post_url') IS NOT NULL AND JSON_VALUE(contact, '$.linkedin_profile_url') IS NOT NULL`;

export type Engagement = {
  id: string;
  personUrl: string;
  name: string;
  title: string;
  location: string;
  companyKey: string;
  companyName: string;
  companyUrl: string;
  employeeRange: string;
  industry: string;
  kind: "comment" | "reaction";
  postUrl: string;
  postDate: string;
  postExcerpt: string;
  comment: string;
  author: Author;
  detected: string;
  icp: boolean;
  points: number;
};

export type Person = {
  personUrl: string;
  name: string;
  title: string;
  companyKey: string;
  companyName: string;
  companyUrl: string;
  employeeRange: string;
  industry: string;
  icp: boolean;
  score: number;
  ourPosts: number;
  adjacentPosts: number;
  comments: number;
  firstSeen: string;
  lastSeen: string;
  authors: string[];
  events: Engagement[];
};

export type Account = {
  companyKey: string;
  companyName: string;
  companyUrl: string;
  employeeRange: string;
  industry: string;
  icp: boolean;
  score: number;
  people: Person[];
  icpPeople: number;
  lastSeen: string;
};

export type Post = {
  postUrl: string;
  author: Author;
  postDate: string;
  excerpt: string;
  engagers: number;
  icpEngagers: number;
  comments: number;
  repeatEngagers: number;
};

// ICP fit from config.ts. A badge and a filter, never a reason to drop a row.
export function isIcp(
  title: string,
  employeeRange: string,
  industry: string,
  companyText: string,
): boolean {
  return (
    ICP.titles.test(title) &&
    !ICP.excludedTitles.test(title) &&
    ICP.employeeRanges.includes(employeeRange) &&
    !ICP.excludedIndustries.test(industry) &&
    !ICP.ownCompany.test(companyText)
  );
}

function daysBetween(from: string, to: Date): number {
  return Math.max(
    0,
    (to.getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

function points(
  kind: Engagement["kind"],
  ours: boolean,
  detected: string,
  now: Date,
): number {
  const base = kind === "comment" ? SCORING.comment : SCORING.reaction;
  const source = ours ? 1 : SCORING.adjacentFactor;
  return (
    base *
    source *
    Math.pow(0.5, daysBetween(detected, now) / SCORING.halfLifeDays)
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeUrl(url: string): string {
  return url.split("?")[0].replace(/\/+$/, "").toLowerCase();
}

export function toEngagement(
  row: Record<string, unknown>,
  now: Date,
): Engagement | undefined {
  const handleMatch = /\/in\/([^/?]+)/i.exec(text(row.tracked));
  const author =
    handleMatch !== null ? AUTHORS[handleMatch[1].toLowerCase()] : undefined;
  if (author === undefined) return undefined;
  const kind = text(row.engagement_type) === "comment" ? "comment" : "reaction";
  const companyUrl = text(row.company_url);
  const companyName = text(row.company_name);
  const title = text(row.title);
  const employeeRange = text(row.employee_range);
  const industry = text(row.industry);
  const detected = text(row.detected);
  return {
    id: text(row.id),
    personUrl: normalizeUrl(text(row.person_url)),
    name: [text(row.first_name), text(row.last_name)]
      .filter((part) => part.length > 0)
      .join(" "),
    title,
    location: text(row.location),
    companyKey:
      companyUrl.length > 0
        ? normalizeUrl(companyUrl)
        : companyName.toLowerCase(),
    companyName,
    companyUrl,
    employeeRange,
    industry,
    kind,
    postUrl: text(row.post_url),
    postDate: text(row.post_date),
    postExcerpt: text(row.post_excerpt),
    comment: text(row.comment),
    author,
    detected,
    icp: isIcp(
      title,
      employeeRange,
      industry,
      `${text(row.website)} ${companyUrl}`,
    ),
    points: points(kind, author.ours, detected, now),
  };
}

export type Board = {
  engagements: Engagement[];
  people: Person[];
  accounts: Account[];
  posts: Post[];
  loadedAt: Date;
  warnings: string[];
};

export function buildBoard(
  engagements: Engagement[],
  now: Date,
  warnings: string[],
): Board {
  const people = new Map<string, Person>();
  for (const event of engagements) {
    let person = people.get(event.personUrl);
    if (person === undefined) {
      person = {
        personUrl: event.personUrl,
        name: event.name,
        title: event.title,
        companyKey: event.companyKey,
        companyName: event.companyName,
        companyUrl: event.companyUrl,
        employeeRange: event.employeeRange,
        industry: event.industry,
        icp: event.icp,
        score: 0,
        ourPosts: 0,
        adjacentPosts: 0,
        comments: 0,
        firstSeen: event.detected,
        lastSeen: event.detected,
        authors: [],
        events: [],
      };
      people.set(event.personUrl, person);
    }
    person.events.push(event);
    person.score += event.points;
    if (event.detected > person.lastSeen) {
      // The latest sighting carries the current title and company.
      person.lastSeen = event.detected;
      person.title = event.title;
      person.companyKey = event.companyKey;
      person.companyName = event.companyName;
      person.companyUrl = event.companyUrl;
      person.employeeRange = event.employeeRange;
      person.industry = event.industry;
      person.icp = event.icp;
    }
    if (event.detected < person.firstSeen) person.firstSeen = event.detected;
  }

  for (const person of people.values()) {
    const ours = new Set<string>();
    const adjacent = new Set<string>();
    const authors = new Set<string>();
    for (const event of person.events) {
      (event.author.ours ? ours : adjacent).add(event.postUrl);
      authors.add(event.author.name);
      if (event.kind === "comment") person.comments += 1;
    }
    person.ourPosts = ours.size;
    person.adjacentPosts = adjacent.size;
    person.authors = [...authors];
    person.events.sort((a, b) => (a.detected < b.detected ? 1 : -1));
  }

  const peopleList = [...people.values()].sort((a, b) => b.score - a.score);

  const accounts = new Map<string, Account>();
  for (const person of peopleList) {
    if (person.companyKey.length === 0) continue;
    let account = accounts.get(person.companyKey);
    if (account === undefined) {
      account = {
        companyKey: person.companyKey,
        companyName: person.companyName,
        companyUrl: person.companyUrl,
        employeeRange: person.employeeRange,
        industry: person.industry,
        icp: false,
        score: 0,
        people: [],
        icpPeople: 0,
        lastSeen: person.lastSeen,
      };
      accounts.set(person.companyKey, account);
    }
    account.people.push(person);
    account.score += person.score;
    if (person.icp) {
      account.icpPeople += 1;
      account.icp = true;
    }
    if (person.lastSeen > account.lastSeen) account.lastSeen = person.lastSeen;
  }

  const posts = new Map<string, Post & { people: Map<string, Person> }>();
  for (const event of engagements) {
    if (!event.author.ours) continue;
    let post = posts.get(event.postUrl);
    if (post === undefined) {
      post = {
        postUrl: event.postUrl,
        author: event.author,
        postDate: event.postDate,
        excerpt: event.postExcerpt,
        engagers: 0,
        icpEngagers: 0,
        comments: 0,
        repeatEngagers: 0,
        people: new Map(),
      };
      posts.set(event.postUrl, post);
    }
    if (event.kind === "comment") post.comments += 1;
    const person = people.get(event.personUrl);
    if (person !== undefined) post.people.set(person.personUrl, person);
  }
  const postList: Post[] = [...posts.values()].map(
    ({ people: engagers, ...post }) => {
      const list = [...engagers.values()];
      return {
        ...post,
        engagers: list.length,
        icpEngagers: list.filter((person) => person.icp).length,
        repeatEngagers: list.filter((person) => person.ourPosts >= 2).length,
      };
    },
  );

  return {
    engagements,
    people: peopleList,
    accounts: [...accounts.values()].sort((a, b) => b.score - a.score),
    posts: postList.sort((a, b) => (a.postDate < b.postDate ? 1 : -1)),
    loadedAt: now,
    warnings,
  };
}

export function daysAgo(date: string, now: Date): number {
  return Math.floor(daysBetween(date, now));
}

export function toCsv(header: string[], lines: (string | number)[][]): string {
  const cell = (value: string | number) => {
    const raw = String(value);
    return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  };
  return [header, ...lines].map((line) => line.map(cell).join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
