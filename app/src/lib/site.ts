export const site = {
  name: "SLPL Store",
  company: "Saaradaa Learknowations Pvt Ltd",
  tagline: "Many publish books. We build futures.",
  description:
    "Official store of Saaradaa Learknowations — school textbooks from Pre-Primary to Grade 12, novels, poem books and class bundles, delivered across India.",
  contact: {
    person: "Mohammad Ismail",
    phone: "+91 79891 91962",
    email: "saradapublications18@gmail.com",
    address: "Nagole, Hyderabad, Telangana",
    whatsapp: "https://wa.me/917989191962",
  },
  links: {
    main: "https://theslpl.in",
    lms: "https://study.theslpl.in",
    journal: "https://journal.e2eindia.org",
  },
} as const;

export const bookCategories = [
  { slug: "pre-primary", name: "Pre-Primary", series: "Baby Steps", grades: "Nursery · LKG · UKG" },
  { slug: "primary", name: "Primary", series: "Little Leaps", grades: "Grade 1 – 5" },
  { slug: "high-school", name: "High School", series: "Skill Builders", grades: "Grade 6 – 10" },
  { slug: "senior-secondary", name: "Senior Secondary", series: "Ascent", grades: "Grade 11 – 12" },
  { slug: "novels-poems", name: "Novels & Poems", series: "", grades: "" },
] as const;

export const mainNav = [
  { href: "/category/pre-primary", label: "Pre-Primary" },
  { href: "/category/primary", label: "Primary" },
  { href: "/category/high-school", label: "High School" },
  { href: "/category/novels-poems", label: "Novels & Poems" },
  { href: "/bundles", label: "Bundles" },
  { href: "/services", label: "Services" },
] as const;
