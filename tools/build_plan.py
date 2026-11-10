"""Builds the plan data the app uses: frontend/data/plan.json plus the product photos in frontend/img/p.

Usage: python -I tools/build_plan.py
Reads the store catalogue in tools/data/products_2717.json (one store's online catalogue: id, name,
pack, price, size, photo) and downloads any product photo that is not cached yet.

The app works everything out from this data (frontend/planmath.js): each meal's ingredients after the
user's swaps, macros per meal, day and week, and the cheapest pack mix for the shopping lists. This
script computes the same numbers for the unedited menu and stores them under "expected", so a test can
check the app's maths against it.
"""
import itertools, json, math, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CAT = {str(p['id']): p for p in json.loads((ROOT / 'tools/data/products_2717.json').read_text(encoding='utf-8'))}
# Products bought outside that store. Ids start with a letter so they never clash with the catalogue's.
EXTRA = {
 'A898740': dict(name='Cacao soluble 0% sin azúcares añadidos Producto Alcampo', price='3.90', size=0.4, fmt='kg', store='Alcampo',
                 thumb='https://www.compraonline.alcampo.es/images-v3/37ea0506-72ec-4543-93c8-a77bb916ec12/4bde8b35-8ed7-4555-b137-f4012c0b0bbe/300x300.jpg'),
}
CAT.update(EXTRA)
IMG = ROOT / 'frontend/img/p'
OUT = ROOT / 'frontend/data/plan.json'
H = {'User-Agent': 'Mozilla/5.0 (personal shopping list)'}

# ingredient -> pack options (product id, amount per pack in the base unit), unit, and nutrition as
# (protein, carbs, fat, kcal) per 100 g / 100 ml, or per piece when perunit is set.
# Sources: Open Food Facts by barcode where its numbers add up; otherwise standard reference values.
ING = {
 'bread':   dict(n='Panecillos', packs=[('11667', 495)], u='g', nut=(9, 53, 2.5, 271), weekly=1, group='carb', piece=45,
                 cook='Serve on the side, or as a bocadillo.'),
 'burgos':  dict(n='Queso fresco Burgos 0%', packs=[('51074', 375)], u='g', nut=(12.3, 4, 0.2, 69), weekly=1),
 'batido':  dict(n='Queso fresco batido 0%', packs=[('51071', 500)], u='g', nut=(8, 3.6, 0.2, 46), weekly=1),
 'lomo':    dict(n='Lomo embuchado (lonchas)', packs=[('86444', 150)], u='g', nut=(38, 1, 5, 199), weekly=1),
 'milk':    dict(n='Leche semidesnatada', packs=[('10381', 6000), ('10382', 1000)], u='ml', nut=(3.2, 4.7, 1.6, 46)),
 'cacao':   dict(n='Cacao soluble 0% azúcares', packs=[('A898740', 400)], u='g', nut=(12, 36, 9, 319), pantry=1),
 'coffee':  dict(n='Café en cápsula extra forte', packs=[('16363', 16)], u='ud', nut=(0, 0, 0, 0), perunit=1, pantry=1),
 'peanuts': dict(n='Cacahuetes', packs=[('13451', 200)], u='g', nut=(24, 12, 50, 618)),
 'banana':  dict(n='Plátano de Canarias', packs=[('3819', 1)], u='ud', nut=(1.7, 32, 0.4, 140), perunit=1, weekly=1, approx=1),
 'pear':    dict(n='Peras Conferencia', packs=[('14470', 1120)], u='g', nut=(0.4, 13.5, 0.1, 57), weekly=1, approx=1),
 'grapes':  dict(n='Uva roja sin semillas', packs=[('3321', 600)], u='g', nut=(0.7, 16, 0.2, 69), weekly=1),
 'chicken': dict(n='Pechugas de pollo congeladas', packs=[('25277', 1140)], u='g', nut=(22.5, 0, 1.5, 105), group='protein',
                 cook='Breast in thin fillets, hot pan with a little oil, 3–4 min a side.'),
 'egg':     dict(n='Huevos', packs=[('30167', 24)], u='ud', nut=(7.5, 0.4, 6, 85), perunit=1, group='protein',
                 cook='Scrambled in the pan, or boiled 10 min.'),
 # Per tin, drained (60 g): 21 g protein, 18 g fat, 252 kcal per 100 g drained (Open Food Facts, EAN 8480000180551).
 'tuna':    dict(n='Atún claro en aceite de girasol (lata)', packs=[('18055', 6)], u='ud', nut=(12.6, 0, 10.8, 151), perunit=1, group='protein',
                 cook='Drain the tin and stir it in at the end.'),
 # Per tin, drained (85 g). Open Food Facts' numbers don't add up for this product; reference values for
 # mackerel in olive oil, drained: 21 g protein, 14 g fat, 213 kcal per 100 g.
 'caballa': dict(n='Filetes de caballa en aceite de oliva (lata)', packs=[('13628', 2)], u='ud', nut=(17.9, 0, 11.9, 181), perunit=1, group='protein',
                 cook='Drain the tin and add it at the end, in pieces.'),
 'potato':  dict(n='Papas', packs=[('69088', 5000)], u='g', nut=(2, 17, 0.1, 80), group='carb',
                 cook='Papas in chunks in salted boiling water 15–20 min, or thin slices 6–7 min in the microwave, covered.'),
 'onion':   dict(n='Cebolla troceada congelada', packs=[('13568', 450)], u='g', nut=(1.2, 7, 0.2, 42)),
 'pepper':  dict(n='Pimiento rojo y verde congelado', packs=[('35221', 450)], u='g', nut=(1, 4.6, 0.3, 25)),
 'beans':   dict(n='Judía verde congelada', packs=[('61283', 1000)], u='g', nut=(1.8, 4, 0.2, 30)),
 'rice':    dict(n='Arroz largo', packs=[('5063', 1000)], u='g', nut=(7, 78, 0.6, 350), group='carb',
                 cook='Rice in plenty of salted boiling water, 15–18 min, drain.'),
 'pasta':   dict(n='Spaghetti', packs=[('6245', 1000)], u='g', nut=(12, 71, 1.5, 355), group='carb',
                 cook='Spaghetti in salted boiling water, 10–11 min.'),
 'tomato':  dict(n='Tomate frito', packs=[('17132', 1200)], u='g', nut=(1.4, 8, 4, 81)),
 'cheese':  dict(n='Queso rallado 4 quesos', packs=[('21581', 200)], u='g', nut=(23, 1, 28, 360)),
 'oil':     dict(n='Aceite de girasol', packs=[('4040', 1000)], u='ml', nut=(0, 0, 100, 900), pantry=1),
 'mojo':    dict(n='Mojo picón', packs=[('52508', 200)], u='g', nut=(1, 8, 40, 400), pantry=1),
 'soy':     dict(n='Salsa de soja', packs=[('17360', 250)], u='ml', nut=(6, 6, 0, 60), pantry=1),
}
# Swaps keep the same carbs (carb group) or the same protein (protein group).
GROUPS = {'carb': ['rice', 'potato', 'pasta', 'bread'], 'protein': ['chicken', 'tuna', 'egg', 'caballa']}
# Saturday is a football day: a bigger lunch, as this much extra of the lunch's carb.
FOOTBALL = dict(day=5, extra={'rice': 30, 'pasta': 30, 'potato': 130, 'bread': 45})
SPICES = [('60573', 'Pimentón dulce'), ('5598', 'Orégano'), ('34125', 'Curry'), ('86656', 'Ajo granulado')]
VAR = {
 'pimenton': ('Pimentón', {}, 'a teaspoon of pimentón dulce + a pinch of ajo granulado'),
 'oregano':  ('Orégano', {}, 'a good pinch of orégano + a pinch of ajo granulado'),
 'curry':    ('Curry', {}, 'a teaspoon of curry, stirred in with the onion'),
 'mojo':     ('Mojo picón', {'mojo': 15}, 'a tablespoon of mojo picón on top when served'),
 'soja':     ('Soja', {'soy': 10}, 'a tablespoon of salsa de soja at the end'),
 'ajo':      ('Ajillo', {}, 'ajo granulado in the oil a minute before the meat'),
}
R = {
 'R1': dict(name='Pollo al horno con papas', time='10 min work, 25 min oven', ing={'chicken': 170, 'potato': 250, 'onion': 50, 'oil': 5}, main='25277',
   steps=['Night before: move the breasts you need from the freezer to the fridge.',
          'Oven to 200 °C. Papas in chunks on the tray with the onion, oil and salt, 15 min first.',
          'Add the breasts with the spice of the day, 20–25 min more until the inside is white.',
          'Cooking extra breasts? Keep them in a tupper in the fridge, up to 3 days, for the arroz frito.']),
 'R2': dict(name='Pollo a la plancha con arroz y judías', time='20 min', ing={'chicken': 160, 'rice': 60, 'beans': 150, 'oil': 5}, main='25277',
   steps=['Rice: 60 g in plenty of salted boiling water, 15–18 min, drain.',
          'Judías from frozen into a pan with a splash of water, 8 min.',
          'Breast in thin fillets, hot pan with a little oil, 3–4 min a side. Spice or sauce of the day.']),
 'R3': dict(name='Espaguetis con atún y tomate', time='15 min', ing={'pasta': 80, 'tuna': 2, 'tomato': 60, 'onion': 50, 'cheese': 15}, main='18055',
   steps=['Spaghetti in salted boiling water, 10–11 min.',
          'Meanwhile: frozen onion in a pan with a splash of water until soft, then tomate frito, the drained tuna and the spice.',
          'Mix with the spaghetti, 4 quesos on top.']),
 'R4': dict(name='Papas revueltas con huevo y atún', time='15 min', ing={'egg': 3, 'potato': 200, 'onion': 50, 'tuna': 1, 'oil': 10}, main='30167',
   steps=['Papas in thin slices, 6–7 min in the microwave, covered, with a splash of water.',
          'Pan with the oil: onion 3 min, then the papas until golden.',
          'Beat 3 eggs with the drained tuna and the spice, pour in, stir until just set.']),
 'R5': dict(name='Arroz frito con pollo', time='15 min with cooked chicken', ing={'chicken': 150, 'rice': 70, 'pepper': 100, 'egg': 1, 'oil': 5}, main='25277',
   steps=['Uses a breast from the last oven tray, cut in cubes.',
          "Rice cooked (yesterday's is best). Hot pan, oil, frozen peppers 4 min.",
          'Add rice and chicken, push to one side, scramble the egg in the gap, mix. Sauce or spice of the day.']),
 'R6': dict(name='Espaguetis con pollo y tomate', time='15 min', ing={'chicken': 150, 'pasta': 70, 'tomato': 80, 'onion': 50, 'oil': 5}, main='6245',
   steps=['Spaghetti in salted boiling water, 10–11 min.',
          'Breast in small cubes, hot pan with the oil, 5 min. Add the frozen onion, 3 min.',
          'Tomate frito and the spice, 2 min, mix with the spaghetti.']),
 'R7': dict(name='Bocadillo de pollo con pimientos', time='10 min', ing={'bread': 90, 'chicken': 140, 'pepper': 100, 'oil': 5}, main='11667',
   steps=['Frozen peppers in a hot pan with the oil, 5 min, set aside.',
          'Breast in thin fillets, same pan, 3 min a side.',
          'Into 2 panecillos with the peppers and the sauce of the day.']),
 'R8': dict(name='Judías con papas, huevo y atún', time='20 min', ing={'beans': 200, 'potato': 200, 'egg': 2, 'tuna': 1, 'oil': 5}, main='61283',
   steps=['Eggs in boiling water 10 min, then into cold water.',
          'Papas in chunks + judías from frozen in salted boiling water, 15 min, drain.',
          'Plate with the tuna and the halved eggs, oil and the spice on top.']),
}
FIXED = [
 ('Breakfast', {'bread': 90, 'burgos': 62.5, 'lomo': 30, 'milk': 250, 'cacao': 10}, '2 panecillos with 1 tarrinita of queso Burgos 0% and 30 g of lomo embuchado, a glass of milk with cacao'),
 ('Mid-morning', {'milk': 150, 'coffee': 1, 'banana': 1, 'peanuts': 20}, 'Café con leche (1 capsule), 1 plátano, a small handful of cacahuetes (20 g)'),
 ('After lunch', {'pear': 170}, '1 pear'),
 ('Late snack', {'batido': 250, 'cacao': 10}, '250 g queso fresco batido 0% with a spoon of cacao, like chocolate pudding'),
]
AFTER_LUNCH_GRAPES = dict(days=[2, 3, 5, 6], ing={'grapes': 150}, text='Grapes, 150 g')
D = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
# Two weeks, lunch and dinner: (recipe, flavour, batch-cooking note).
CAL = [
 [('R1', 'pimenton', 'Cook 3 breasts: today, Tue, Thu'), ('R3', 'oregano', '')],
 [('R1', 'pimenton', "From Monday's tray"), ('R4', 'pimenton', '')],
 [('R2', 'mojo', ''), ('R6', 'oregano', '')],
 [('R5', 'soja', 'Chicken from Monday'), ('R8', 'pimenton', '')],
 [('R2', 'soja', ''), ('R3', 'mojo', '')],
 [('R6', 'pimenton', ''), ('R4', 'oregano', '')],
 [('R1', 'curry', 'Cook 3 breasts: today, Mon, Wed'), ('R7', 'mojo', '')],
 [('R1', 'curry', "From Sunday's tray"), ('R3', 'pimenton', '')],
 [('R2', 'ajo', ''), ('R8', 'ajo', '')],
 [('R5', 'curry', 'Chicken from Sunday'), ('R6', 'oregano', '')],
 [('R2', 'mojo', ''), ('R4', 'pimenton', '')],
 [('R1', 'oregano', 'Cook 2 breasts: today, Sat'), ('R3', 'oregano', '')],
 [('R5', 'soja', 'Chicken from Friday'), ('R7', 'ajo', '')],
 [('R2', 'soja', ''), ('R8', 'pimenton', '')],
]


def macros(ing):
    t = [0.0, 0.0, 0.0, 0.0]
    for i, a in ing.items():
        f = a if ING[i].get('perunit') else a / 100
        for k in range(4):
            t[k] += ING[i]['nut'][k] * f
    return dict(p=round(t[0]), c=round(t[1]), f=round(t[2]), k=round(t[3] / 10) * 10)


def meal_ing(d, slot, rid, var):
    ing = dict(R[rid]['ing'])
    for i, a in VAR[var][1].items():
        ing[i] = ing.get(i, 0) + a
    if d % 7 == FOOTBALL['day'] and slot == 0:
        carb = next((i for i in ing if ING[i].get('group') == 'carb'), None)
        if carb:
            ing[carb] += FOOTBALL['extra'][carb]
    return ing


def best(packs, amount):
    bestc = None
    for counts in itertools.product(*[range(0, int(math.ceil(amount / s)) + 2) for _, s in packs]):
        cov = sum(c * s for c, (_, s) in zip(counts, packs))
        if cov + 1e-9 < amount:
            continue
        cost = sum(c * float(CAT[pid]['price']) for c, (pid, _) in zip(counts, packs))
        if bestc is None or cost < bestc[0] - 1e-9 or (abs(cost - bestc[0]) < 1e-9 and (cov, sum(counts)) < (bestc[1], sum(bestc[2]))):
            bestc = (cost, cov, counts)
    return bestc


def photo(pid):
    f = IMG / f'{pid}.jpg'
    if not f.exists():
        u = CAT[pid]['thumb'] if pid in EXTRA else CAT[pid]['thumb'].split('?')[0] + '?fit=crop&h=240&w=240'
        f.write_bytes(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=30).read())
    return f'img/p/{pid}.jpg'


def main():
    need = [{}, {}]
    days = []
    for d in range(14):
        w = d // 7
        tot = {}
        for name, ing, _ in FIXED:
            if name == 'After lunch' and d % 7 in AFTER_LUNCH_GRAPES['days']:
                ing = AFTER_LUNCH_GRAPES['ing']
            for i, a in ing.items():
                tot[i] = tot.get(i, 0) + a
        for slot, (rid, var, _) in enumerate(CAL[d]):
            for i, a in meal_ing(d, slot, rid, var).items():
                tot[i] = tot.get(i, 0) + a
        for i, a in tot.items():
            need[w][i] = need[w].get(i, 0) + a
        days.append(macros(tot))

    shops = {1: {}, 2: {}}
    for i, m in ING.items():
        n1, n2 = need[0].get(i, 0), need[1].get(i, 0)
        if not n1 + n2:
            continue
        if m.get('weekly'):
            _, cov1, k1 = best(m['packs'], n1)
            left = cov1 - n1
            k2 = best(m['packs'], n2 - left)[2] if n2 - left > 0 else tuple(0 for _ in m['packs'])
            for (pid, _), c in zip(m['packs'], k1):
                if c:
                    shops[1][pid] = c
            for (pid, _), c in zip(m['packs'], k2):
                if c:
                    shops[2][pid] = c
        else:
            for (pid, _), c in zip(m['packs'], best(m['packs'], n1 + n2)[2]):
                if c:
                    shops[1][pid] = c

    prod = {}
    for i, m in ING.items():
        for pid, size in m['packs']:
            p = CAT[pid]
            prod[pid] = dict(name=p['name'], size=p['size'], fmt=p['fmt'], price=float(p['price']), ing=i, amount=size, img=photo(pid), store=p.get('store'))
    for pid, _ in SPICES:
        p = CAT[pid]
        prod[pid] = dict(name=p['name'], size=p['size'], fmt=p['fmt'], price=float(p['price']), ing=None, img=photo(pid))
    missing = [rid for rid, r in R.items() if r['main'] not in prod]
    if missing:
        raise SystemExit(f'recipe photo product not in the plan: {missing}')

    data = dict(
        store='Mercadona, 38650 Los Cristianos', prices='9 Nov 2026',
        targets=dict(p=140, k=2200, lowP=130),
        prod=prod,
        ing={k: dict(n=v['n'], u=v['u'], nut=v['nut'], perunit=bool(v.get('perunit')), piece=v.get('piece'), group=v.get('group'),
                     cook=v.get('cook'), weekly=bool(v.get('weekly')), pantry=bool(v.get('pantry')), packs=[p for p, _ in v['packs']]) for k, v in ING.items()},
        groups=GROUPS, football=FOOTBALL,
        recipes={k: dict(name=r['name'], time=r['time'], ing=r['ing'], main=r['main'], steps=r['steps']) for k, r in R.items()},
        variants={k: dict(label=v[0], add=v[1], how=v[2]) for k, v in VAR.items()},
        fixed=[dict(name=a, ing=b, text=c) for a, b, c in FIXED], afterLunchGrapes=AFTER_LUNCH_GRAPES,
        menu=[[dict(r=r, v=v, note=n) for r, v, n in day] for day in CAL],
        spices=[dict(id=p, label=l) for p, l in SPICES],
        expected=dict(days=days, shop1=shops[1], shop2=shops[2]),
    )
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('days protein/carbs/fat/kcal:', [(d['p'], d['c'], d['f'], d['k']) for d in days])
    print('big shop', shops[1])
    print('top-up', shops[2])


if __name__ == '__main__':
    main()
