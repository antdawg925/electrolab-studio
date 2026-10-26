import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1];res=[]
def ck(n,c,i=''):res.append(bool(c));print('PASS' if c else 'FAIL',n,i)
with sync_playwright() as p:
  b=p.chromium.launch();errs=[]
  pg=b.new_page(viewport={'width':1280,'height':800});pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
  pg.goto(URL);pg.wait_for_timeout(800)
  ck('example loaded + solved on first paint','-9.4' in pg.inner_text('#solOut'))
  ck('intro hint visible',pg.locator('#intro').is_visible())
  ck('shortcut legend lists R/F/Shift+F/Ctrl+Z',all(s in pg.inner_text('.keys') for s in ['Rotate','Flip horizontally','Flip vertically','Undo']))
  ck('svg fits card (no h-scroll at 1280)',pg.evaluate("(()=>{const w=document.querySelector('.canvas-wrap');return w.scrollWidth<=w.clientWidth+1})()"))
  pg.click('#introX');ck('intro dismiss',pg.locator('#intro').count()==0)
  pg.reload();pg.wait_for_timeout(500);ck('intro stays dismissed',pg.locator('#intro').count()==0)
  for t in ['ard','nec','cad','sch']:pg.click(f'.tab[data-tab="{t}"]');pg.wait_for_timeout(600)
  pg.click('.tab[data-tab="ard"]');pg.wait_for_timeout(300)
  ck('PID canvas sized to CSS width',pg.evaluate("(()=>{const c=document.getElementById('pidPlot');return Math.abs(c.width/(window.devicePixelRatio>1?Math.min(2,devicePixelRatio):1)-c.clientWidth)<2})()"))
  ck('no console/page errors',not errs,str(errs))
  m=b.new_page(viewport={'width':390,'height':844});m.goto(URL);m.wait_for_timeout(500)
  for t in ['sch','ard','nec','cad']:
    m.click(f'.tab[data-tab="{t}"]');m.wait_for_timeout(500);sw=m.evaluate("document.documentElement.scrollWidth");ck(f'mobile {t} no page overflow',sw<=392,str(sw))
print(sum(res),'/',len(res))
