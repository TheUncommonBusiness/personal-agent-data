// Render check for the "What happens to your data" embed. Usage: node check-render.cjs <url> [shots]
const puppeteer = require('puppeteer-core');
const url = process.argv[2];
const shots = process.argv.includes('shots');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SIZES = [[708, 400], [629, 354], [560, 315], [375, 211], [629, 416], [708, 520]];
const TABS = ['train', 'pull', 'after'];
const wait = ms => new Promise(r => setTimeout(r, ms));
if (!url) { console.log('Usage: node check-render.cjs <url> [shots]'); process.exit(2); }
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  let fails = 0, checks = 0;
  for (const [w, h] of SIZES) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await p.goto(url, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    if (!(await p.evaluate(() => document.fonts.check('16px "Season Mix"') && document.fonts.check('16px Inter')))) { fails++; console.log(`FAIL ${w}x${h} fonts not loaded`); }
    for (const t of TABS) {
      await p.evaluate(t => window.dataVisual.setTab(t), t);
      await wait(100);
      const issues = await p.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const card = document.querySelector('.card').getBoundingClientRect();
        const body = document.getElementById('body'), br = body.getBoundingClientRect();
        const out = [];
        if (document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1) out.push('page scrolls');
        document.querySelectorAll('.card *').forEach(e => { if (!vis(e)) return; const r = e.getBoundingClientRect();
          if (r.bottom > card.bottom + .5 || r.right > card.right + .5 || r.top < card.top - .5 || r.left < card.left - .5) out.push('outside card: ' + e.tagName + '.' + e.className); });
        body.querySelectorAll('*').forEach(e => { if (!vis(e)) return; const r = e.getBoundingClientRect();
          if (r.bottom > br.bottom + .5 || r.right > br.right + .5) out.push('clipped: ' + e.tagName + '.' + e.className + ' "' + (e.textContent || '').slice(0, 24) + '"'); });
        // text boxes whose content is taller than the box (cell clipping)
        body.querySelectorAll('.tr > *,.agent,.cell,.note,.rl,.ch').forEach(e => { if (vis(e) && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) out.push('content overflows: ' + e.className + ' "' + (e.textContent || '').slice(0, 20) + '"'); });
        const tabs = document.getElementById('tabs');
        if (tabs.scrollWidth > tabs.clientWidth + 1) out.push('tabs overflow');
        return out;
      });
      checks++;
      if (issues.length) { fails++; console.log(`FAIL ${w}x${h} tab ${t}: ${[...new Set(issues)].join(' | ')}`); }
      if (shots) await p.screenshot({ path: `shot-${w}x${h}-${t}.png` });
    }
    await p.close();
  }
  await b.close();
  console.log(fails ? `${fails} failure(s) in ${checks} checks` : `PASS: ${SIZES.length} sizes x ${TABS.length} tabs, nothing clipped, nothing scrolls`);
  process.exit(fails ? 1 : 0);
})();
