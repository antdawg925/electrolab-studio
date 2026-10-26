import sys,re
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; out=sys.argv[2]
res=[];errs=[]
def ck(n,c,info=''):res.append((n,bool(c)));print(('PASS' if c else 'FAIL'),n,info)
with sync_playwright() as p:
  b=p.chromium.launch();pg=b.new_page(viewport={'width':1400,'height':900})
  pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept(DIALOG[0]))
  DIALOG=['']
  pg.goto(URL);pg.wait_for_timeout(800)
  sol=lambda:pg.inner_text('#solOut')
  ck('inverting example solves',' -9.4' in sol() or '-9.400' in sol(),sol()[:120])
  # saturation: set Vin to 5V -> -23.5 ideal -> clip -15
  pg.evaluate("parts[0].v=5;draw()")
  ck('saturates at -15',"-15.0000" in sol() and 'saturated' in sol().lower(),sol()[:200])
  ck('SAT label drawn',pg.locator('.satlab').count()==1)
  pg.screenshot(path=out+'/sat.png')
  # custom rails via label prompt
  DIALOG[0]='12, -12';pg.locator('.oplab').click();pg.wait_for_timeout(200)
  ck('custom rails -12',"-12.0000" in sol(),sol()[:150])
  pg.evaluate("parts[0].v=2;draw()")
  ck('unsaturated back to linear',pg.locator('.satlab').count()==0 and '-9.4000' in sol())
  # rotate op-amp 4x keeps solution & connectivity check after rotate via function
  base=sol()
  pg.evaluate("const o=parts.find(p=>p.t==='O');for(let i=0;i<4;i++)rotatePart(o);draw()")
  ck('4x rotate identity',sol()==base)
  pg.evaluate("const o=parts.find(p=>p.t==='O');flipPart(o,false);flipPart(o,false);flipPart(o,true);flipPart(o,true);draw()")
  ck('double flips identity',sol()==base)
  # rotated op-amp circuit: build non-inverting buffer with op-amp rotated 90 and wire to new terminal positions
  r=pg.evaluate("""()=>{parts=[];const o={t:'O',x:10,y:10,rot:1};parts.push(o);const [m,pl,out]=terms(o);
   parts.push({t:'V',a:[pl[0],pl[1]-4],b:pl,v:3},{t:'G',x:pl[0],y:pl[1]-4},{t:'W',a:out,b:[m[0],out[1]]},{t:'W',a:[m[0],out[1]],b:m},{t:'R',a:out,b:[out[0],out[1]+4],v:1000},{t:'G',x:out[0],y:out[1]+4});draw();
   return {m,pl,out,txt:document.getElementById('solOut').innerText}}""")
  ck('rotated op-amp pins move (rot=1)',r['out']==[10,12] and r['m']==[11,8],str(r['m'])+str(r['pl'])+str(r['out']))
  ck('rotated buffer solves 3V out','3.0000' in r['txt'] and 'Cannot' not in r['txt'],r['txt'][:150])
  pg.screenshot(path=out+'/rotated_opamp.png')
  # UI rotate via hover + R key on a resistor in divider
  pg.click('#exDiv');pg.wait_for_timeout(200)
  before=pg.evaluate("JSON.stringify(parts[2])")
  box=pg.locator('#svg').bounding_box()
  pg.mouse.move(box['x']+8*25,box['y']+4*25);pg.wait_for_timeout(100)  # midpoint of R a:[4,4] b:[12,4]
  pg.keyboard.press('r');pg.wait_for_timeout(100)
  after=pg.evaluate("JSON.stringify(parts[2])")
  ck('hover+R rotates resistor',after!=before and '"a":[8,0]' in after,after)
  ck('R key did not switch tool',pg.evaluate("tool")=='R')
  pg.keyboard.press('Control+z');ck('undo rotate',pg.evaluate("JSON.stringify(parts[2])")==before)
  # rotated resistor connectivity: rotate 2x (180) = same nodes swapped
  base=sol();pg.evaluate("rotatePart(parts[3]);rotatePart(parts[3]);draw()")
  ck('180° resistor keeps connectivity',re.findall(r'N\d = [-\d.]+',sol())==re.findall(r'N\d = [-\d.]+',base))
  # Rotate tool click
  pg.click('button[data-t="T"]');pg.mouse.click(box['x']+12*25,box['y']+8*25);pg.wait_for_timeout(100)
  ck('rotate tool clicks part',pg.evaluate("JSON.stringify(parts[3].a)")!='[12,4]',pg.evaluate("JSON.stringify(parts[3])"))
  # Flip tool on V source swaps polarity
  pg.click('button[data-t="F"]');pg.keyboard.down('Shift');pg.mouse.click(box['x']+4*25,box['y']+8*25);pg.keyboard.up('Shift');pg.wait_for_timeout(100)
  ck('shift-flip V source swaps ends',pg.evaluate("JSON.stringify(parts[0])").find('"a":[4,4]')>0,pg.evaluate("JSON.stringify(parts[0])"))
  ck('F key selected flip tool',pg.evaluate("(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'t'}));return tool})()")=='T')
  # regressions
  pg.evaluate("parts=[];hist=[];draw()");pg.keyboard.press('Escape')
  pg.keyboard.press('r');pg.mouse.move(0,0)
  pg.mouse.click(box['x']+100,box['y']+100);pg.mouse.click(box['x']+200,box['y']+100)
  ck('place resistor',pg.evaluate("parts.length")==1)
  DIALOG[0]='4.7k';pg.locator('#svg text',has_text='1 kΩ').click();ck('SI parse 4.7k',pg.evaluate("parts[0].v")==4700)
  pg.keyboard.press('m');pg.mouse.move(box['x']+150,box['y']+100);pg.mouse.down();pg.mouse.move(box['x']+150,box['y']+150,steps=5);pg.mouse.up()
  ck('move works',pg.evaluate("parts[0].a[1]")==6,pg.evaluate("JSON.stringify(parts[0])"))
  pg.keyboard.press('Control+z');ck('undo move',pg.evaluate("parts[0].a[1]")==4)
  pg.mouse.click(box['x']+150,box['y']+100,button='right');ck('right-click delete',pg.evaluate("parts.length")==0)
  pg.keyboard.press('Control+z');ck('undo delete',pg.evaluate("parts.length")==1)
  pg.click('#exInv');pg.wait_for_timeout(200);pg.screenshot(path=out+'/desktop.png')
  m=b.new_page(viewport={'width':390,'height':844});m.goto(URL);m.wait_for_timeout(600)
  sw=m.evaluate("document.documentElement.scrollWidth");ck('mobile no h-overflow',sw<=392,str(sw));m.screenshot(path=out+'/mobile.png',full_page=True)
  for t in ['ard','nec','cad']:
    pg.click(f'button[data-tab="{t}"]');pg.wait_for_timeout(300)
  ck('no page errors',not errs,str(errs))
  b.close()
print(sum(c for _,c in res),'/',len(res))
