// Methods & Sources build helper. No dependencies; needs Node 18+.
//
//   node scripts/build.mjs                       -> rebuilds guides/index.html from the guide files
//   node scripts/build.mjs https://your-domain   -> also writes sitemap.xml and adds it to robots.txt
//
// The site itself holds no domain: canonicals and structured data use root-relative URLs.
// The sitemap protocol requires absolute URLs, so it is only generated when you pass a domain.
// Do not upload the scripts/ folder to your host.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDES = join(ROOT, 'guides');

/** Hub sections, in display order. Guides not listed here land in "More guides". */
const CATEGORIES = [
  { id: 'ai-tools', name: 'AI research tools', tag: 'AI tools', slugs: ['choose-ai-research-assistant', 'ai-hallucinated-citations', 'elicit-vs-consensus-vs-scispace', 'ai-prompts-for-research', 'ai-policy-academic-writing'] },
  { id: 'literature', name: 'Finding and reading literature', tag: 'Literature', slugs: ['ai-literature-review-workflow', 'boolean-search-operators', 'grey-literature-search', 'read-research-papers-faster', 'research-note-taking', 'literature-synthesis-matrix'] },
  { id: 'evidence', name: 'Systematic reviews and evidence', tag: 'Evidence', slugs: ['systematic-review-software', 'critical-appraisal-tools', 'risk-of-bias-assessment', 'how-to-read-a-forest-plot', 'evidence-based-practice-steps'] },
  { id: 'design', name: 'Planning and study design', tag: 'Study design', slugs: ['identify-research-gap', 'research-proposal-structure', 'case-study-research', 'pilot-study', 'survey-question-design', 'survey-sample-size', 'interview-guide', 'research-ethics-informed-consent', 'data-management-plan'] },
  { id: 'analysis', name: 'Data analysis and statistics', tag: 'Analysis', slugs: ['likert-scale-analysis', 'correlation-vs-regression', 'p-values-confidence-intervals', 'effect-size-explained', 'thematic-analysis-steps', 'reproducible-research-workflow'] },
  { id: 'writing', name: 'Academic writing and citation', tag: 'Writing', slugs: ['how-to-write-an-abstract', 'research-paper-introduction', 'discussion-section', 'how-to-write-a-lab-report', 'argumentative-essay-structure', 'annotated-bibliography', 'paraphrase-without-plagiarism', 'plain-language-summary', 'citation-styles-compared'] },
  { id: 'thesis', name: 'Thesis and PhD', tag: 'Thesis', slugs: ['phd-research-toolkit', 'choose-dissertation-topic', 'dissertation-timeline'] },
  { id: 'publishing', name: 'Publishing and professional work', tag: 'Publishing', slugs: ['how-to-peer-review-a-paper', 'choose-a-journal', 'predatory-journals', 'journal-cover-letter', 'research-impact-metrics', 'conference-presentation', 'policy-brief', 'grant-budget-justification'] },
];

const esc = (s) => s.replace(/&(?!amp;|lt;|gt;|quot;|#\d+;|[a-z]+;)/g, '&amp;').replace(/</g, '&lt;');
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function readGuide(file) {
  const html = readFileSync(join(GUIDES, file), 'utf8');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const desc = html.match(/<meta name="description" content="([^"]*)"/);
  if (!h1) throw new Error(`No <h1> in guides/${file}`);
  return { slug: file.replace(/\.html$/, ''), title: strip(h1[1]), description: desc ? desc[1] : '' };
}

const guides = readdirSync(GUIDES)
  .filter((f) => f.endsWith('.html') && f !== 'index.html')
  .map(readGuide);
const bySlug = new Map(guides.map((g) => [g.slug, g]));

const listed = new Set(CATEGORIES.flatMap((c) => c.slugs));
const extra = guides.filter((g) => !listed.has(g.slug)).map((g) => g.slug);
const sections = [...CATEGORIES, ...(extra.length ? [{ id: 'more', name: 'More guides', tag: 'Guide', slugs: extra }] : [])]
  .map((c) => ({ ...c, items: c.slugs.map((s) => bySlug.get(s)).filter(Boolean) }))
  .filter((c) => c.items.length);

const missing = CATEGORIES.flatMap((c) => c.slugs).filter((s) => !bySlug.has(s));
if (missing.length) console.warn(`Not written yet (skipped): ${missing.join(', ')}`);

const card = (g, tag) =>
  `          <div class="card"><span class="tag">${tag}</span><h3><a href="${g.slug}.html">${esc(g.title)}</a></h3><p>${esc(g.description)}</p></div>`;

const sectionHtml = sections
  .map(
    (c) => `    <section class="section" id="${c.id}">
      <div class="wrap">
        <div class="section-head"><h2>${c.name}</h2><span class="muted small">${c.items.length} guide${c.items.length === 1 ? '' : 's'}</span></div>
        <div class="grid grid-3">
${c.items.map((g) => card(g, c.tag)).join('\n')}
        </div>
      </div>
    </section>`,
  )
  .join('\n\n');

const ordered = sections.flatMap((c) => c.items);
const itemList = ordered.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.title, url: `/guides/${g.slug}.html` }));
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Research guides',
  url: '/guides/',
  isPartOf: { '@type': 'WebSite', name: 'Methods & Sources', url: '/' },
  mainEntity: { '@type': 'ItemList', numberOfItems: itemList.length, itemListElement: itemList },
};

const jump = sections.map((c) => `<a href="#${c.id}">${c.name}</a>`).join(' · ');

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Research Guides: Methods, Writing, Statistics and AI Tools</title>
  <meta name="description" content="${ordered.length} practical research guides for students, researchers and professionals: literature reviews, study design, statistics, academic writing, publishing and AI tools.">
  <link rel="canonical" href="/guides/">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Methods &amp; Sources">
  <meta property="og:title" content="Research guides — Methods &amp; Sources">
  <meta property="og:description" content="Practical, tested guides to research methods, academic writing and AI research tools.">
  <meta name="theme-color" content="#1f5c46">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../assets/css/style.css">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>

  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="../index.html"><span class="brand-mark" aria-hidden="true">M</span>Methods &amp; Sources</a>
      <nav class="nav" aria-label="Main">
        <a href="index.html" aria-current="page">Guides</a>
        <a href="../index.html#workflow">Research workflow</a>
        <a href="elicit-vs-consensus-vs-scispace.html">Tool comparisons</a>
        <a href="../about.html">About</a>
      </nav>
    </div>
  </header>

  <main id="main">
    <section class="hero" style="padding-bottom:40px">
      <div class="wrap read">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="../index.html">Home</a> / Guides</nav>
        <p class="kicker">All ${ordered.length} guides</p>
        <h1>Research guides</h1>
        <p class="lead">Methods first, tools second. Each guide explains how a stage of research is done well, with steps, examples and templates, then shows where AI helps and how to check what it gives you.</p>
        <p class="small muted" style="margin-top:18px">Jump to: ${jump}</p>
      </div>
    </section>

${sectionHtml}
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="brand" href="../index.html"><span class="brand-mark" aria-hidden="true">M</span>Methods &amp; Sources</a>
          <p class="muted small" style="margin-top:12px">Practical guides to research methods, academic writing and the AI tools that help, tested on real questions.</p>
        </div>
        <div>
          <h4>Start here</h4>
          <ul>
            <li><a href="choose-ai-research-assistant.html">Choosing an AI research assistant</a></li>
            <li><a href="ai-literature-review-workflow.html">AI literature review workflow</a></li>
            <li><a href="phd-research-toolkit.html">The PhD research toolkit</a></li>
          </ul>
        </div>
        <div>
          <h4>Methods</h4>
          <ul>
            <li><a href="systematic-review-software.html">Systematic review software</a></li>
            <li><a href="identify-research-gap.html">Finding a research gap</a></li>
            <li><a href="citation-styles-compared.html">Citation styles compared</a></li>
          </ul>
        </div>
        <div>
          <h4>Site</h4>
          <ul>
            <li><a href="index.html">All guides</a></li>
            <li><a href="../about.html">About &amp; editorial policy</a></li>
            <li><a href="https://aiforresearch.app/">AI for Research</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Methods &amp; Sources</span>
        <span>Published by the team behind AI for Research. Always read your sources.</span>
      </div>
    </div>
  </footer>
</body>
</html>
`;

writeFileSync(join(GUIDES, 'index.html'), page);
console.log(`guides/index.html: ${ordered.length} guides in ${sections.length} sections`);

// ---- Optional sitemap ----
const domain = process.argv[2]?.replace(/\/+$/, '');
if (domain) {
  if (!/^https?:\/\/[^/]+$/.test(domain)) throw new Error('Pass the domain as https://example.org');
  const today = new Date().toISOString().slice(0, 10);
  const paths = ['/', '/guides/', '/about.html', ...ordered.map((g) => `/guides/${g.slug}.html`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${domain}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
  writeFileSync(join(ROOT, 'sitemap.xml'), xml);
  const robotsPath = join(ROOT, 'robots.txt');
  const robots = existsSync(robotsPath) ? readFileSync(robotsPath, 'utf8').replace(/^Sitemap:.*\n?/gm, '').trimEnd() : 'User-agent: *\nAllow: /';
  writeFileSync(robotsPath, `${robots}\n\nSitemap: ${domain}/sitemap.xml\n`);
  console.log(`sitemap.xml: ${paths.length} URLs; robots.txt updated`);
}
