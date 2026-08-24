const fs = require('fs');
const path = 'apps/web/src/pages/DashboardPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// PieChart max-width fix is mostly handled by CSS but let's check PieChart component if we need to.
// Let's fix the links in dashboard
code = code.replace(/style=\{\{\s*fontSize:\s*'0.85rem',\s*color:\s*'var\(--df-text-muted\)',\s*textDecoration:\s*'none',\s*fontWeight:\s*600\s*\}\}/g, "style={{ fontSize: '0.85rem', color: 'var(--df-text-muted)', textDecoration: 'none', fontWeight: 600, padding: '0.5rem', margin: '-0.5rem' }}");

fs.writeFileSync(path, code);
