import type { ExploreCity } from "@/features/explore/types";

export const jiaxingCity = {
  slug: "jiaxing",
  name: "Jiaxing",
  province: "Zhejiang",
  country: "China",
  eyebrow: "Kondo city guide · Zhejiang",
  title: "Jiaxing, open by design.",
  tagline: "Where industry, culture, and student ambition meet.",
  summary:
    "A student-first gateway to the companies, products, campuses, opportunities, events, and everyday services shaping Jiaxing.",
  description:
    "Set between Shanghai and Hangzhou, Jiaxing connects deep manufacturing expertise with digital trade, new materials, international education, and the cultural life of the Yangtze River Delta.",
  signals: [
    { label: "Region", value: "Yangtze River Delta" },
    { label: "Growth engines", value: "Textiles · PV glass · digital trade" },
    { label: "Kondo bridge", value: "Students ↔ city opportunity" },
  ],
  impactPoints: [
    {
      title: "Promote local excellence",
      description:
        "Give Jiaxing companies, products, campuses, and public institutions a clear international student-facing window.",
    },
    {
      title: "Turn arrival into belonging",
      description:
        "Help students understand the city faster—from transport and hospitals to fairs, culture, and campus life.",
    },
    {
      title: "Build opportunity pathways",
      description:
        "Create a future-ready discovery layer for verified internships, graduate roles, projects, and partnerships.",
    },
  ],
  sections: [
    {
      slug: "companies",
      title: "Local Companies",
      shortTitle: "Companies",
      eyebrow: "Built in Jiaxing",
      summary:
        "Meet the industrial leaders and emerging ecosystems connecting Jiaxing to global markets.",
      description:
        "From polyester and technical textiles to photovoltaic glass, industrial components, and digital trade, Jiaxing offers students a close view of globally connected production.",
      icon: "companies",
      accent: "emerald",
      signal: "5 company and ecosystem spotlights",
      studentValue:
        "Understand local industries before applying for projects, internships, or graduate opportunities.",
      cityValue:
        "Present Jiaxing employers through an international, student-friendly discovery layer.",
      entries: [
        {
          id: "jx-company-tongkun",
          slug: "tongkun-group",
          type: "company",
          title: "Tongkun Group",
          category: "Textiles & advanced materials",
          summary:
            "A Jiaxing-headquartered industrial group with a major polyester and filament manufacturing base and a broad materials value chain.",
          location: "Tongxiang, Jiaxing",
          status: "Future company profile ready",
          tags: ["Polyester", "Technical textiles", "Manufacturing"],
          details: [
            "Industrial-scale fiber and materials production",
            "R&D, logistics, trade, and advanced manufacturing context",
            "Relevant pathways for engineering, business, and supply-chain students",
          ],
          source: {
            label: "Official company site",
            href: "https://www.tongkungroup.com/en",
          },
        },
        {
          id: "jx-company-flat-glass",
          slug: "flat-glass-group",
          type: "company",
          title: "Flat Glass Group",
          category: "Photovoltaic & architectural glass",
          summary:
            "A Jiaxing-based glass group combining research, manufacturing, processing, and international operations.",
          location: "Xiuzhou, Jiaxing",
          status: "Future company profile ready",
          tags: ["Solar", "New materials", "Export"],
          details: [
            "Photovoltaic, float, architectural, and household glass",
            "Strong connection to renewable-energy supply chains",
            "A useful lens on advanced materials and export manufacturing",
          ],
          source: {
            label: "Official company profile",
            href: "https://www.flatgroup.com.cn/en/about",
          },
        },
        {
          id: "jx-company-xinfengming",
          slug: "xinfengming-group",
          type: "company",
          title: "Xinfengming Group",
          category: "Chemical fibers & manufacturing",
          summary:
            "A major Tongxiang industrial enterprise in the polyester and fiber ecosystem that supports Jiaxing's textile depth.",
          location: "Tongxiang, Jiaxing",
          status: "Future company profile ready",
          tags: ["Fibers", "Production", "Innovation"],
          details: [
            "Part of the city's dense textile-manufacturing network",
            "Relevant to materials, automation, operations, and trade",
            "Potential future pathway for verified employer opportunities",
          ],
          source: {
            label: "Official company site",
            href: "https://www.xinfengming.com/cn/about",
          },
        },
        {
          id: "jx-company-tong-ming",
          slug: "tong-ming-zhejiang",
          type: "company",
          title: "Tong Ming Zhejiang",
          category: "Industrial manufacturing",
          summary:
            "A Jiaxing Economic Development Zone manufacturer focused on stainless-steel fasteners and industrial wire.",
          location: "Jiaxing Economic Development Zone",
          status: "Future company profile ready",
          tags: ["Fasteners", "Industrial products", "Supply chain"],
          details: [
            "Industrial components used across many manufacturing sectors",
            "A practical example of specialized export-oriented production",
            "Relevant to mechanical engineering and international business",
          ],
          source: {
            label: "Official company profile",
            href: "https://eng.tonggroup.com.tw/",
          },
        },
        {
          id: "jx-company-digital-trade",
          slug: "cross-border-digital-trade",
          type: "company",
          title: "Cross-border Digital Trade",
          category: "E-commerce ecosystem",
          summary:
            "A directory-ready cluster for Jiaxing exporters, platform operators, service providers, and international market teams.",
          location: "Across Jiaxing",
          status: "Partner directory framework",
          tags: ["E-commerce", "Export", "International markets"],
          details: [
            "Future verified company and partner profiles",
            "International marketing and localization opportunities",
            "Student projects connecting local products to global audiences",
          ],
        },
      ],
    },
    {
      slug: "products",
      title: "Local Products",
      shortTitle: "Products",
      eyebrow: "Made in Jiaxing",
      summary:
        "Discover the products and production stories behind Jiaxing's international reach.",
      description:
        "Jiaxing's product identity stretches from fibers and fashion supply chains to solar glass, industrial components, and beloved regional specialties.",
      icon: "products",
      accent: "amber",
      signal: "5 local product stories",
      studentValue:
        "See how design, engineering, logistics, branding, and culture become real products.",
      cityValue:
        "Make local production legible and memorable for a new international audience.",
      entries: [
        {
          id: "jx-product-fibers",
          slug: "polyester-technical-textiles",
          type: "product",
          title: "Polyester & Technical Textiles",
          category: "Textile materials",
          summary:
            "High-volume fibers and performance materials that feed clothing, interiors, industrial fabrics, and global supply chains.",
          location: "Tongxiang textile cluster",
          status: "Future product collection ready",
          tags: ["Fiber", "Materials", "B2B"],
          details: [
            "From raw material to finished textile applications",
            "Strong links to R&D, quality, and industrial design",
            "A foundation for future verified supplier showcases",
          ],
        },
        {
          id: "jx-product-fashion",
          slug: "fashion-and-knitwear",
          type: "product",
          title: "Fashion & Knitwear",
          category: "Clothing and design",
          summary:
            "A rich ecosystem of yarn, fabric, knitwear, apparel production, wholesale, and fashion presentation.",
          location: "Jiaxing and Tongxiang",
          status: "Future product collection ready",
          tags: ["Fashion", "Clothing", "Design"],
          details: [
            "A bridge between manufacturing capability and creative direction",
            "International branding and content potential",
            "Useful context for fashion, business, and media students",
          ],
        },
        {
          id: "jx-product-glass",
          slug: "photovoltaic-glass",
          type: "product",
          title: "Photovoltaic Glass",
          category: "Clean-energy materials",
          summary:
            "Specialized glass supporting solar modules, energy-efficient buildings, and the low-carbon economy.",
          location: "Xiuzhou manufacturing base",
          status: "Future product collection ready",
          tags: ["Solar", "Glass", "Energy"],
          details: [
            "Precision manufacturing and materials science",
            "Direct connection to renewable-energy supply chains",
            "A strong case study for green-industry students",
          ],
        },
        {
          id: "jx-product-fasteners",
          slug: "industrial-fasteners",
          type: "product",
          title: "Industrial Fasteners",
          category: "Industrial products",
          summary:
            "Stainless-steel screws, nuts, rods, and wire—the small components that keep large industries moving.",
          location: "Jiaxing Economic Development Zone",
          status: "Future product collection ready",
          tags: ["Components", "Stainless steel", "Export"],
          details: [
            "Specialized production with broad industrial demand",
            "Quality, standards, and logistics are central to value",
            "Relevant to engineering and global supply-chain study",
          ],
        },
        {
          id: "jx-product-specialties",
          slug: "jiaxing-specialties",
          type: "product",
          title: "Jiaxing Specialties",
          category: "Food and local culture",
          summary:
            "Zongzi and other regional products turn local memory, craft, and hospitality into a distinctive city story.",
          location: "Across Jiaxing",
          status: "Future local-maker profiles",
          tags: ["Zongzi", "Culture", "Local makers"],
          details: [
            "A welcoming entry point into Jiaxing culture",
            "Opportunities for storytelling, packaging, and tourism",
            "Future profiles can connect students with verified local makers",
          ],
        },
      ],
    },
    {
      slug: "universities",
      title: "Universities",
      shortTitle: "Universities",
      eyebrow: "Learn in Jiaxing",
      summary:
        "Explore campuses, academic pathways, international services, and the city's wider research ecosystem.",
      description:
        "Jiaxing combines student life with close access to manufacturing, entrepreneurship, culture, and Yangtze River Delta networks.",
      icon: "universities",
      accent: "blue",
      signal: "3 education and research spotlights",
      studentValue:
        "Compare the campus, program, and support context that shapes daily international student life.",
      cityValue:
        "Connect education to the city's innovation, industry, and international cooperation story.",
      entries: [
        {
          id: "jx-university-jxu",
          slug: "jiaxing-university",
          type: "university",
          title: "Jiaxing University",
          category: "Comprehensive university",
          summary:
            "A multi-campus university with undergraduate, master's, Chinese-language, and international cooperation pathways.",
          location: "Lianglin and Pinghu campuses",
          status: "Future university profile ready",
          tags: ["Bachelor's", "Master's", "International students"],
          details: [
            "Campus overview: Lianglin and Pinghu",
            "Programs across multiple academic disciplines",
            "Dedicated international education, admissions, and student-service systems",
          ],
          source: {
            label: "Official international office",
            href: "https://global.zjxu.edu.cn/About_JXU/Introduction_of_JXU.htm",
          },
        },
        {
          id: "jx-university-nanhu",
          slug: "jiaxing-nanhu-university",
          type: "university",
          title: "Jiaxing Nanhu University",
          category: "Applied higher education",
          summary:
            "A local institution positioned within Jiaxing's practical education and regional development landscape.",
          location: "Nanhu District, Jiaxing",
          status: "Future university profile ready",
          tags: ["Applied learning", "Campus life", "Regional development"],
          details: [
            "Future campus overview and student-life profile",
            "Program directory designed for later verified expansion",
            "International-service information to be published with the institution",
          ],
          source: {
            label: "Official university site",
            href: "https://www.jxnhu.edu.cn/",
          },
        },
        {
          id: "jx-university-research",
          slug: "yangtze-delta-innovation-ecosystem",
          type: "university",
          title: "Yangtze Delta Innovation Ecosystem",
          category: "Research and entrepreneurship",
          summary:
            "Research institutes, labs, competitions, and industry partnerships create routes beyond the classroom.",
          location: "Across Jiaxing",
          status: "Future research-partner directory",
          tags: ["Research", "Innovation", "Industry collaboration"],
          details: [
            "A future directory for research institutes and joint labs",
            "Innovation competitions and company-linked projects",
            "Clear distinction between degree programs and research partners",
          ],
        },
      ],
    },
    {
      slug: "jobs",
      title: "Jobs & Internships",
      shortTitle: "Jobs",
      eyebrow: "Grow in Jiaxing",
      summary:
        "A future-ready opportunity board connecting international students with verified local employers.",
      description:
        "The architecture separates opportunity type, employer, location, skills, and verification state so internships, graduate roles, and student projects can later move into the database cleanly.",
      icon: "jobs",
      accent: "violet",
      signal: "5 opportunity pathways prepared",
      studentValue:
        "Discover which skills Jiaxing industries need and prepare before verified positions open.",
      cityValue:
        "Create a responsible bridge between local talent needs and international student capability.",
      entries: [
        {
          id: "jx-job-textile-internship",
          slug: "textile-innovation-internship",
          type: "opportunity",
          title: "Textile Innovation Internship",
          category: "Internship pathway",
          summary:
            "A future verified pathway for materials research, product development, quality, or sustainable textile projects.",
          location: "Tongxiang and Jiaxing",
          status: "Partner verification required",
          tags: ["Internship", "Materials", "R&D"],
          details: [
            "For engineering, chemistry, design, and sustainability students",
            "Employer, eligibility, and work-permit review before publishing",
            "Structured learning goals and supervisor details in future records",
          ],
        },
        {
          id: "jx-job-manufacturing-graduate",
          slug: "advanced-manufacturing-graduate",
          type: "opportunity",
          title: "Advanced Manufacturing Graduate Track",
          category: "Graduate job pathway",
          summary:
            "A future route into production engineering, automation, quality systems, and operations.",
          location: "Jiaxing industrial zones",
          status: "Partner verification required",
          tags: ["Graduate", "Engineering", "Operations"],
          details: [
            "Role profiles will include language and technical requirements",
            "Only verified employer listings will be publishable",
            "Future database records support deadlines and application status",
          ],
        },
        {
          id: "jx-job-digital-trade",
          slug: "digital-trade-project",
          type: "opportunity",
          title: "Digital Trade Student Project",
          category: "Student project pathway",
          summary:
            "International market research, localization, content, and e-commerce projects for export-focused teams.",
          location: "Jiaxing",
          status: "Partner verification required",
          tags: ["Student project", "E-commerce", "Marketing"],
          details: [
            "Suitable for business, language, media, and data students",
            "Project scope and compensation must be explicit",
            "University and legal eligibility checks remain mandatory",
          ],
        },
        {
          id: "jx-job-international-market",
          slug: "international-market-research",
          type: "opportunity",
          title: "International Market Research",
          category: "Internship or graduate pathway",
          summary:
            "Help Jiaxing brands understand African markets, customer behavior, distribution, and communication.",
          location: "Hybrid across Jiaxing",
          status: "Partner verification required",
          tags: ["Africa–China", "Research", "Export"],
          details: [
            "A distinctive bridge between Kondo's community and the city",
            "Designed for transparent, scoped, supervised projects",
            "Future profiles can match language and market expertise",
          ],
        },
        {
          id: "jx-job-campus-ambassador",
          slug: "city-innovation-ambassador",
          type: "opportunity",
          title: "City Innovation Ambassador",
          category: "Student role pathway",
          summary:
            "A future campus-to-city program supporting events, visitor welcome, research, and international storytelling.",
          location: "Campus and city venues",
          status: "Program concept",
          tags: ["Student role", "Events", "Community"],
          details: [
            "Potential collaboration with campuses and city partners",
            "Clear time, training, and safeguarding requirements",
            "Built for verified opportunities—not informal job posts",
          ],
        },
      ],
    },
    {
      slug: "events",
      title: "Local Events",
      shortTitle: "Events",
      eyebrow: "Meet Jiaxing",
      summary:
        "A city calendar framework for exhibitions, innovation, campus life, business exchange, and culture.",
      description:
        "Events are organized as recurring discovery themes until verified dates, venues, registration links, and organizers are connected.",
      icon: "events",
      accent: "rose",
      signal: "5 event themes to follow",
      studentValue:
        "Find spaces to learn, network, contribute, and understand Jiaxing beyond campus.",
      cityValue:
        "Bring exhibitions, fairs, competitions, and cultural programming to an international student audience.",
      entries: [
        {
          id: "jx-event-textile-fairs",
          slug: "textile-and-fashion-fairs",
          type: "event",
          title: "Textile & Fashion Fairs",
          category: "Industry exhibitions",
          summary:
            "Trade showcases, textile exhibitions, and fashion activity reveal the scale and creativity of the local industry.",
          location: "Jiaxing and Tongxiang",
          status: "Dates require organizer verification",
          tags: ["Textiles", "Fashion", "Business"],
          details: [
            "Future records support dates, venues, tickets, and organizers",
            "Student-friendly explanations of professional events",
            "Potential company visits and volunteer pathways",
          ],
        },
        {
          id: "jx-event-innovation",
          slug: "innovation-competitions",
          type: "event",
          title: "Innovation Competitions",
          category: "Technology and entrepreneurship",
          summary:
            "Challenges, demo days, and student competitions connecting ideas with research and industry.",
          location: "Campuses and innovation spaces",
          status: "Dates require organizer verification",
          tags: ["Competition", "Startup", "Technology"],
          details: [
            "Team formation and eligibility fields are architecture-ready",
            "Future links can support verified registration",
            "Strong fit for cross-disciplinary international teams",
          ],
        },
        {
          id: "jx-event-digital",
          slug: "digital-economy-exchange",
          type: "event",
          title: "Digital Economy Exchange",
          category: "Technology and digital trade",
          summary:
            "Talks and business exchange around the internet economy, cross-border commerce, and digital transformation.",
          location: "Across Jiaxing and Tongxiang",
          status: "Dates require organizer verification",
          tags: ["Digital", "E-commerce", "Networking"],
          details: [
            "International student orientation for professional programs",
            "Future speaker, organizer, and registration profiles",
            "A bridge to Jiaxing's wider digital-economy story",
          ],
        },
        {
          id: "jx-event-campus",
          slug: "university-activities",
          type: "event",
          title: "University Activities",
          category: "Campus life",
          summary:
            "Welcome weeks, international days, academic talks, sports, clubs, and community programs.",
          location: "Jiaxing campuses",
          status: "Campus verification required",
          tags: ["Campus", "Clubs", "Community"],
          details: [
            "Designed for university-specific event feeds later",
            "Supports public and member-only visibility in future data",
            "Helps new students find belonging quickly",
          ],
        },
        {
          id: "jx-event-cultural",
          slug: "cultural-festivals",
          type: "event",
          title: "Cultural Festivals",
          category: "City culture",
          summary:
            "Seasonal festivals, heritage experiences, food culture, and public celebrations across Jiaxing.",
          location: "Nanhu and surrounding districts",
          status: "Dates require organizer verification",
          tags: ["Culture", "Festival", "Local life"],
          details: [
            "A welcoming route into history and local customs",
            "Future multilingual event summaries",
            "Practical transport and accessibility notes can attach later",
          ],
        },
      ],
    },
    {
      slug: "services",
      title: "City Services",
      shortTitle: "Services",
      eyebrow: "Live well in Jiaxing",
      summary:
        "A calm starting point for transport, health, banking, government services, and emergencies.",
      description:
        "This guide prioritizes orientation over legal or medical advice. Students should confirm changing procedures with their university and the responsible public institution.",
      icon: "services",
      accent: "cyan",
      signal: "6 essential service guides",
      studentValue:
        "Know where to start when everyday tasks feel unfamiliar or urgent.",
      cityValue:
        "Make public services clearer and more approachable for international residents.",
      entries: [
        {
          id: "jx-service-transport",
          slug: "transportation",
          type: "service",
          title: "Transportation",
          category: "Getting around",
          summary:
            "High-speed rail, city buses, taxis, cycling, and campus routes connect Jiaxing with the wider region.",
          location: "Citywide",
          status: "Verify live routes before travel",
          tags: ["Rail", "Bus", "Taxi"],
          details: [
            "Jiaxing South is a key high-speed rail gateway",
            "Keep destination names available in Chinese",
            "Use official transport channels for live schedules and fares",
          ],
        },
        {
          id: "jx-service-health",
          slug: "hospitals-and-health",
          type: "service",
          title: "Hospitals & Health",
          category: "Healthcare orientation",
          summary:
            "Start with your university clinic or international office for routine guidance; use emergency services when urgent.",
          location: "Citywide",
          status: "Not medical advice",
          tags: ["Hospital", "Clinic", "Insurance"],
          details: [
            "Bring identification and relevant insurance information",
            "Ask your university which facilities support international students",
            "Medical emergency number: 120",
          ],
        },
        {
          id: "jx-service-banks",
          slug: "banks-and-payments",
          type: "service",
          title: "Banks",
          category: "Everyday finance",
          summary:
            "Prepare identification, local contact details, and university documents before visiting a branch.",
          location: "Commercial districts and campus areas",
          status: "Requirements vary by bank",
          tags: ["Banking", "Documents", "Branches"],
          details: [
            "Confirm required documents directly with the bank",
            "Use only official apps and verified service desks",
            "Kondo does not process or hold payments",
          ],
        },
        {
          id: "jx-service-government",
          slug: "government-offices",
          type: "service",
          title: "Government Offices",
          category: "Official procedures",
          summary:
            "Residence, registration, and official procedures should begin with current guidance from your university.",
          location: "District and city service locations",
          status: "Procedures can change",
          tags: ["Residence", "Registration", "Official"],
          details: [
            "Confirm the responsible office before traveling",
            "Bring originals and copies requested by official guidance",
            "Never rely on an unverified intermediary for immigration matters",
          ],
        },
        {
          id: "jx-service-public",
          slug: "public-services",
          type: "service",
          title: "Public Services",
          category: "Daily city life",
          summary:
            "Utilities, mobile service, postal delivery, libraries, and community centers form the practical city layer.",
          location: "Across Jiaxing",
          status: "Future verified service directory",
          tags: ["Utilities", "Mobile", "Community"],
          details: [
            "Future profiles can include hours, language support, and maps",
            "University support remains the best first step for new arrivals",
            "Report outdated information through future Kondo feedback tools",
          ],
        },
        {
          id: "jx-service-emergency",
          slug: "emergency-contacts",
          type: "service",
          title: "Emergency Contacts",
          category: "Urgent help",
          summary:
            "Save China's core emergency numbers and your university's current emergency contact on your phone.",
          location: "China-wide",
          status: "Essential information",
          tags: ["Police 110", "Fire 119", "Medical 120"],
          details: [
            "Police: 110",
            "Fire: 119 · Medical emergency: 120",
            "Traffic incidents: 122 · Contact your university after immediate danger is addressed",
          ],
        },
      ],
    },
    {
      slug: "about",
      title: "About Jiaxing",
      shortTitle: "About",
      eyebrow: "A city with momentum",
      summary:
        "History, water, industry, innovation, and regional connection give Jiaxing a character of its own.",
      description:
        "Kondo presents Jiaxing through a student lens: not only as a place to study, but as a city where international residents can understand local strengths and contribute meaningfully.",
      icon: "about",
      accent: "slate",
      signal: "5 chapters of the Jiaxing story",
      studentValue:
        "Understand the context behind the city you live in—and find your place within it.",
      cityValue:
        "Tell a coherent international story that connects heritage, industry, education, and cooperation.",
      entries: [
        {
          id: "jx-story-history",
          slug: "history-and-nanhu",
          type: "story",
          title: "History & Nanhu",
          category: "City heritage",
          summary:
            "Waterways, the Grand Canal region, Nanhu, and long-standing commercial culture shape Jiaxing's identity.",
          location: "Jiaxing",
          tags: ["History", "Nanhu", "Water towns"],
          details: [
            "A city story shaped by water and movement",
            "Historic places offer context beyond the classroom",
            "Future guides can connect cultural sites with practical visits",
          ],
        },
        {
          id: "jx-story-innovation",
          slug: "innovation",
          type: "story",
          title: "Innovation",
          category: "Research and technology",
          summary:
            "Digital transformation, research collaboration, new materials, and entrepreneurship are part of Jiaxing's modern direction.",
          location: "Across Jiaxing",
          tags: ["Technology", "Research", "Entrepreneurship"],
          details: [
            "Innovation connects campuses with local industry",
            "Competitions create practical entry points for students",
            "Future Kondo profiles can surface verified labs and programs",
          ],
        },
        {
          id: "jx-story-industry",
          slug: "industry",
          type: "story",
          title: "Industry",
          category: "Economic strengths",
          summary:
            "Textiles, advanced fibers, photovoltaic glass, specialized manufacturing, and trade give Jiaxing global relevance.",
          location: "Jiaxing and county-level cities",
          tags: ["Textiles", "Manufacturing", "Export"],
          details: [
            "Deep production capability meets international markets",
            "Students can learn from complete supply-chain ecosystems",
            "Company profiles will make the landscape easier to navigate",
          ],
        },
        {
          id: "jx-story-cooperation",
          slug: "international-cooperation",
          type: "story",
          title: "International Cooperation",
          category: "Global connection",
          summary:
            "Universities, exporters, manufacturers, and innovation programs give Jiaxing many reasons to work across borders.",
          location: "Yangtze River Delta",
          tags: ["Partnerships", "Education", "Trade"],
          details: [
            "International students bring language and market knowledge",
            "Local partners bring industrial and cultural expertise",
            "Kondo can help both sides discover responsible collaboration",
          ],
        },
        {
          id: "jx-story-why-students",
          slug: "why-students-choose-jiaxing",
          type: "story",
          title: "Why Students Choose Jiaxing",
          category: "Student perspective",
          summary:
            "A manageable city scale, regional access, campus communities, industrial depth, and cultural discovery create room to grow.",
          location: "Jiaxing",
          tags: ["Student life", "Opportunity", "Belonging"],
          details: [
            "Close enough to major regional centers, with its own identity",
            "Real-world industries sit near campus learning",
            "Kondo makes the city's people, services, and opportunities easier to find",
          ],
        },
      ],
    },
  ],
} satisfies ExploreCity;
