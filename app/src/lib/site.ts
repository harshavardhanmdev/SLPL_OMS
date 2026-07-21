export const site = {
  name: "SLPL Store",
  company: "Saaradaa Learknowations Pvt Ltd",
  tagline: "Many publish books. We build futures.",
  description:
    "Official store of Saaradaa Learknowations - research-oriented school textbooks from Pre-Primary to Grade 12, UPSC Civils foundation material, novels, poem books and class bundles, delivered across India.",
  contact: {
    person: "Ramesh Mamidala",
    phone: "+91 90303 90077",
    email: "saradapublications18@gmail.com",
    address: "2-3-472, Road No. 3D, Sai Nagar Colony, Nagole, Hyderabad - 500068",
    whatsapp: "https://wa.me/919030390077",
  },
  links: {
    main: "https://theslpl.in",
    lms: "https://study.theslpl.in",
    journal: "https://journal.e2eindia.org",
  },
} as const;

// DTDC has no per-consignment URL; customers paste the AWB on this page.
// Admin-overridable via the tracking_url_template setting.
export const DEFAULT_TRACKING_URL = "https://www.dtdc.com/track-your-shipment";

export const bookCategories = [
  { slug: "pre-primary", name: "Pre-Primary", series: "Baby Steps", grades: "Nursery · LKG · UKG" },
  { slug: "primary", name: "Primary", series: "Little Leaps", grades: "Grade 1 - 5" },
  { slug: "high-school", name: "High School", series: "Skill Builders", grades: "Grade 6 - 10" },
  { slug: "senior-secondary", name: "Senior Secondary", series: "Ascent", grades: "Grade 11 - 12" },
  { slug: "novels-poems", name: "Novels & Poems", series: "", grades: "" },
] as const;

export const mainNav = [
  { href: "/category/pre-primary", label: "Pre-Primary" },
  { href: "/category/primary", label: "Primary" },
  { href: "/category/high-school", label: "High School" },
  { href: "/category/novels-poems", label: "Novels & Poems" },
  { href: "/bundles", label: "Bundles" },
  { href: "/competitive-exams", label: "Competitive Exams" },
  { href: "/services", label: "Services" },
] as const;
