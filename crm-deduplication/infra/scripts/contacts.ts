// Contact normalization, clustering, and survivor selection. These functions
// are bundled into typed script nodes, so the contract and deployed workflow
// execute the same implementation.

export type Contact = {
  id: string;
  email: string | undefined;
  phone: string | undefined;
  phoneKeys: string[];
  linkedinUrl: string | undefined;
  linkedinPersonId: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  jobTitle: string | undefined;
  primaryAssociatedCompanyId: string | undefined;
  associatedDeals: number;
  activities: number;
  populatedProperties: number;
  createdAt: string;
  lastModifiedAt: string;
  rawValues: Record<string, string | undefined>;
};

const GENERIC_EMAIL_LOCAL_PARTS = [
  "admin",
  "contact",
  "hello",
  "info",
  "office",
  "sales",
  "support",
  "team",
];

export const normalizeEmail = (value: unknown): string | undefined => {
  const normalized = text(value)?.toLowerCase();
  return normalized === "" ? undefined : normalized;
};

export const normalizeLinkedInPersonUrl = (
  value: unknown,
): string | undefined => {
  const normalized = text(value)
    ?.toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  return normalized === "" ? undefined : normalized;
};

export const linkedinUrlVariants = (value: unknown): string[] => {
  const handle = normalizeLinkedInPersonUrl(value);
  if (handle === undefined) return [];
  return [
    `https://linkedin.com/in/${handle}`,
    `https://linkedin.com/in/${handle}/`,
    `https://www.linkedin.com/in/${handle}`,
    `https://www.linkedin.com/in/${handle}/`,
  ];
};

export const normalizePhone = (value: unknown): string | undefined => {
  const raw = text(value);
  if (raw === undefined) return undefined;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits === "") return undefined;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00") && digits.length > 4)
    return `+${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("0") === false) {
    return `+1${digits}`;
  }
  return digits;
};

export const phoneMatchKeys = (value: unknown): string[] => {
  const raw = text(value);
  if (raw === undefined) return [];
  const digits = raw.replace(/[^\d]/g, "");
  const keys = [normalizePhone(raw), digits === "" ? undefined : digits];
  if (digits.startsWith("00") && digits.length > 4) {
    keys.push(`+${digits.slice(2)}`);
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    keys.push(`+33${digits.slice(1)}`);
    keys.push(`+44${digits.slice(1)}`);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    keys.push(`+44${digits.slice(1)}`);
  }
  if (digits.length === 10 && digits.startsWith("0") === false) {
    keys.push(`+1${digits}`);
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    keys.push(`+${digits}`);
  }
  return unique(keys.filter((key): key is string => key !== undefined));
};

export const isGenericEmail = (value: string | undefined): boolean => {
  const localPart = value?.split("@")[0];
  return (
    localPart !== undefined && GENERIC_EMAIL_LOCAL_PARTS.includes(localPart)
  );
};

export const readContacts = (records: unknown): Contact[] => {
  if (Array.isArray(records) === false) return [];
  const contacts = records
    .map((record) => readContact(record))
    .filter((contact): contact is Contact => contact !== undefined);
  return contacts.filter((contact, index) => {
    return contacts.findIndex((other) => other.id === contact.id) === index;
  });
};

export const mergeRecordSets = (left: unknown, right: unknown): unknown[] => {
  const leftRecords = Array.isArray(left) ? left : [];
  const rightRecords = Array.isArray(right) ? right : [];
  return [...leftRecords, ...rightRecords];
};

export const clusterAroundContact = (
  contacts: Contact[],
  source: Contact | undefined,
): Contact[] => {
  if (source === undefined) return [];
  const cluster = [source];
  const remaining = contacts.filter((contact) => contact.id !== source.id);
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index];
      if (cluster.some((contact) => sharesSupportedKey(contact, candidate))) {
        cluster.push(candidate);
        remaining.splice(index, 1);
        changed = true;
      }
    }
  }
  return cluster;
};

export const rankContacts = (cluster: Contact[]): Contact[] => {
  return cluster.slice().sort((left, right) => {
    return (
      right.associatedDeals - left.associatedDeals ||
      right.activities - left.activities ||
      left.createdAt.localeCompare(right.createdAt) ||
      right.populatedProperties - left.populatedProperties ||
      left.id.localeCompare(right.id)
    );
  });
};

export const valuesFor = (
  cluster: Contact[],
  key: "email" | "linkedinUrl" | "linkedinPersonId",
): string[] => {
  return unique(
    cluster
      .map((contact) => contact[key])
      .filter((value): value is string => value !== undefined),
  );
};

export const isHighConfidenceConnected = (cluster: Contact[]): boolean => {
  if (cluster.length < 3) return false;
  const seen = [0];
  for (let cursor = 0; cursor < seen.length; cursor += 1) {
    const current = seen[cursor];
    for (let index = 0; index < cluster.length; index += 1) {
      if (
        seen.includes(index) === false &&
        sharesHighConfidenceKey(cluster[current], cluster[index])
      ) {
        seen.push(index);
      }
    }
  }
  return seen.length === cluster.length;
};

export const phoneKeysOverlap = (left: string[], right: string[]): boolean => {
  return left.some((key) => right.includes(key));
};

const sharesSupportedKey = (left: Contact, right: Contact): boolean => {
  return (
    shares(left.linkedinPersonId, right.linkedinPersonId) ||
    shares(left.linkedinUrl, right.linkedinUrl) ||
    shares(left.email, right.email) ||
    phoneKeysOverlap(left.phoneKeys, right.phoneKeys)
  );
};

const sharesHighConfidenceKey = (left: Contact, right: Contact): boolean => {
  const samePersonId = shares(left.linkedinPersonId, right.linkedinPersonId);
  const sameLinkedinUrl =
    shares(left.linkedinUrl, right.linkedinUrl) &&
    !(
      left.linkedinPersonId !== undefined &&
      right.linkedinPersonId !== undefined &&
      left.linkedinPersonId !== right.linkedinPersonId
    );
  const sameEmail =
    shares(left.email, right.email) &&
    isGenericEmail(left.email) === false &&
    isGenericEmail(right.email) === false;
  return samePersonId || sameLinkedinUrl || sameEmail;
};

const readContact = (record: unknown): Contact | undefined => {
  if (typeof record !== "object" || record === null) return undefined;
  const id = text("id" in record ? record.id : undefined);
  if (id === undefined) return undefined;
  const rawProperties = "properties" in record ? record.properties : undefined;
  const entries: [string, unknown][] =
    typeof rawProperties === "object" && rawProperties !== null
      ? Object.entries(rawProperties)
      : [];
  const properties = Object.fromEntries(entries);
  return {
    id,
    email: normalizeEmail(properties.email),
    phone: normalizePhone(properties.phone),
    phoneKeys: phoneMatchKeys(properties.phone),
    linkedinUrl: normalizeLinkedInPersonUrl(properties.linkedin_url),
    linkedinPersonId: text(properties.linkedin_person_id),
    firstName: text(properties.firstname),
    lastName: text(properties.lastname),
    jobTitle: text(properties.jobtitle),
    primaryAssociatedCompanyId: text(properties.associatedcompanyid),
    associatedDeals: number(properties.num_associated_deals),
    activities:
      number(properties.hs_sales_email_last_replied) +
      number(properties.num_contacted_notes),
    populatedProperties: entries.filter(([, value]) => {
      return value !== null && value !== undefined && value !== "";
    }).length,
    createdAt: text(properties.createdate) ?? "",
    lastModifiedAt: text(properties.lastmodifieddate) ?? "",
    rawValues: {
      email: text(properties.email),
      phone: text(properties.phone),
      linkedin_url: text(properties.linkedin_url),
      linkedin_person_id: text(properties.linkedin_person_id),
      jobtitle: text(properties.jobtitle),
    },
  };
};

const shares = (left: string | undefined, right: string | undefined): boolean =>
  left !== undefined && left === right;

const text = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const result = String(value).trim();
  return result === "" ? undefined : result;
};

const number = (value: unknown): number => {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
};

const unique = <T>(values: T[]): T[] => {
  return values.filter((value, index) => values.indexOf(value) === index);
};
