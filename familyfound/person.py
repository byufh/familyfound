
import geocoding
import datetime
import re

def all_dates(events):
    dates = []
    for e in events:
        if e['date_num']:
            dates.append(txt2date(e['date_num']))
        elif e.has_key('date_fallback'):
            dates.append(txt2date(e['date_fallback']))
    dates.sort()

def ev2date(ev):
    if ev['date_num']:
        return txt2date(ev['date_num'])
    if ev['date']:
        years = re.findall('\d{4}', ev['date'])
    else:
        return False
    if years:
        return txt2date(years[0])
    return False

def txt2date(text):
    parts = text.split('-')
    if len(parts) == 3:
        return datetime.datetime.strptime(text, '%Y-%m-%d')
    elif len(parts) == 2:
        return datetime.datetime.strptime(text, '%Y-%m')
    elif len(parts) == 1:
        return datetime.datetime.strptime(text, '%Y')
    else:
        raise Exception('don\'t know how to handle the date: %s' % text)

def timebetween(start, delta, perc):
    return start + datetime.timedelta(0, perc * delta.total_seconds())

def date2txt(date):
    return '%0.4d-%0.2d-%0.2d' % (date.year, date.month, date.day)
    # return date.strftime('%Y-%m-%d')

def cmp_ev(a, b):
    order = [u'Birth', u'Christening', u'Blessing', u'Marriage', u'Military Service', u'Other', u'Death', u'Burial']
    if a['type'] not in order:
        if b['type'] in order:
            return 1
        else:
            return cmp(a['type'], b['type'])
    elif b['type'] not in order:
        return -1
    r = cmp(order.index(a['type']), order.index(b['type']))
    if not r and a['date_num'] and b['date_num']:
        return cmp(txt2date(a['date_num']), txt2date(b['date_num']))
    return r

def events2dict(events):
    res = {}
    for ev in events:
        res[ev['type']] = res.get(ev['type'], []) + [ev]
    return res

class Person:
    def __init__(self, blob, fs):
        self.data = blob
        if fs:
            self.db = fs.db
        else:
            self.db = None
        self._cache = {}

    def tojson(self):
        events = self.events()
        dates = all_dates(events)
        first = None
        last = None
        if dates:
            first = date2txt(dates[0])
            last = date2txt(dates[-1])
        birth_year = '??'
        death_year = '??'

        edct = events2dict(events)
        for event in edct.get('Birth', ()):
            d = ev2date(event)
            if d:
                birth_year = d.year
        for event in edct.get('Death', ()):
            d = ev2date(event)
            if d:
                death_year = d.year
        if death_year == '??':
            for event in edct.get('Burial', ()):
                d = ev2date(event)
                if d:
                    death_year = d.year

        parents = list(self.parents())
        families = list(self.families())
        info_a = []
        people_a = []
        other_a = []
        for typ, text in self.get_alerts(parents, families, edct):
            if typ == 'info':
                info_a.append(text)
            elif typ == 'people':
                people_a.append(text)
            else:
                other_a.append((typ, text))

        genders = []
        backup = None
        for person in self.data['persons']:
            for gender in person['assertions']['genders']:
                if not gender['selected']:
                    backup = gender['value']['type']
                    continue
                genders.append(gender['value']['type'])
        genders = genders if len(genders) else ([backup] if backup is not None else [])
        gender = genders[0] if len(genders) else None

        pid = self.data['persons'][0]['id']

        names = self.names

        return {
            'id': pid,
            'names': names,
            'name': names[0] if len(names) else None,
            'parents': parents,
            'gender': gender,
            'genders': genders,
            'events': events,
            'first_date': first,
            'last_date': last,
            'birth_year': birth_year,
            'death_year': death_year,
            'families': families,
            'info_alerts': info_a,
            'people_alerts': people_a,
            'other_alerts': other_a,
            'link': self.data.get('link', None)
        }

    def get_alerts(self, parents, families, edct):
        ## errors with parents
        if len(parents) > 2:
            yield ('people', 'Too many parents')
        elif len(parents) < 2:
            yield ('people', 'Missing parents')
        else:
            genders = sorted(p[1] for p in parents)
            if genders != ['Female', 'Male']:
                if genders[0] == 'Female':
                    yield ('people', 'No mother')
                else:
                    yield ('people', 'No father')

        ## errors with birth & death events
        if not edct.has_key('Birth'):
            yield ('info', 'Missing birth event')
        elif len(edct['Birth']) > 1:
            yield ('info', 'Multiple birth events')
        else:
            birth = edct['Birth'][0]
            d = ev2date(birth)
            if not d:
                yield ('info', 'Missing birth date')
            if not birth['place']:
                yield ('info', 'Missing birth place')
            elif not birth['place_geo']:
                yield ('info', 'Can\'t map birth place')
        if not edct.has_key('Death') and not edct.has_key('Burial'):
            yield ('info', 'Missing death event')
        elif len(edct.get('Death', [])) > 1:
            yield ('info', 'Multiple death events')
        else:
            death = edct.get('Death', edct.get('Burial', [None]))[0]
            d = ev2date(death)
            if not d:
                yield ('info', 'Missing death date')
            if not death['place']:
                yield ('info', 'Missing place of death')
            elif not death['place_geo']:
                yield ('info', 'Can\'t map place of death')

        ## errors with families
        if len(families) == 0:
            yield ('people', 'No recorded family')
        elif len(families) > 2:
            yield ('warning', 'Multiple families')
        for family in families:
            if not family['parents']['father'] or not family['parents']['mother']:
                yield ('people', 'Marriage without a spouse')
            if not family['children']:
                yield ('warning', 'Family without children')
            m = family['marriage']
            if not family['marriage']:
                yield ('info', 'Missing marriage event')
            else:
                d = ev2date(family['marriage'])
                if not d:
                    yield ('info', 'Missing marriage date')
                if not family['marriage']['place']:
                    yield ('info', 'Missing place of marriage')
                elif not family['marriage']['place_geo']:
                    yield ('info', 'Can\'t map place of marriage')

    def get_birth_year(self):
        return 1900
    
    def get_death_year(self):
        return 2000

    def get_names(self):
        names = []
        backup = None
        for person in self.data['persons']:
            for assertion in person['assertions'].get('names', []):
                if not assertion['selected']:
                    backup = assertion['value']['forms'][0]['fullText']
                    continue
                for form in assertion['value']['forms']:
                    names.append(form['fullText'])
        names = names if len(names) else ([backup] if backup is not None else [])
        return names
    names = property(get_names)

    def get_name(self):
        return self.get_names()[0]
    name = property(get_name)

    def parents(self):
        parents = []
        for person in self.data['persons']:
            # if there are multiple 'parents' sets, we have an issue.
            for parents in person.get('parents', []):
                for parent in parents['parent']:
                    tup = (parent['id'], parent['gender'])
                    if 'characteristics' in parent:
                        tup += (
                            parent['characteristics'][0]['value']['type'],
                            parent['characteristics'][0]['value']['lineage'])
                    else:
                        tup += (None, None)
                    yield tup

    def families(self):
        '''List the families, but only the info we need.

        Looks like:
            [{
                'children': [id, ..., ...],
                'parents': {'father': id, 'mother': id},
                'marriage': {
                    'place': normalized,
                    'place_geo': geostuff,
                    'date': normalized,
                    'date_num': 'yyyy-mm-dd',
                }
            }, ...]
        '''
        for person in self.data['persons']:
            for family in person.get('families', []):
                children = [c['id'] for c in family.get('child', [])]
                parents = {'father':None, 'mother':None}
                for parent in family['parent']:
                    if parent['gender'] == 'Male':
                        parents['father'] = parent['id']
                    else:
                        parents['mother'] = parent['id']
                marriage = None
                if family['marriage']:
                    marriage = {'date':None, 'date_num':None, 'place':None, 'place_geo':None}
                    m = family['marriage']['value']
                    if m['place']:
                        if m['place']['normalized']:
                            marriage['place'] = m['place']['normalized']['value']
                        else:
                            marriage['place'] = m['place']['original']
                        marriage['place_geo'] = get_geo(marriage['place'], self.db)
                    if m['date']:
                        if m['date'].has_key('normalized'):
                            marriage['date'] = m['date']['normalized']
                        else:
                            marriage['date'] = m['date']['original']
                        marriage['date_num'] = m['date'].get('numeric', None)
                yield {
                    'children': children,
                    'parents': parents,
                    'marriage': marriage
                }

    def events(self):
        events = []
        birth_year = False
        for person in self.data['persons']:
            if not person['assertions'] or not 'events' in person['assertions']:
                continue
            for event in person['assertions']['events']:
                if not event['selected']:
                    continue
                place = None
                if event['value']['place']:
                    if not event['value']['place']['normalized']:
                        place = event['value']['place']['original']
                    else:
                        place = event['value']['place']['normalized']['value']
                info = {'type': event['value']['type'],
                       'place': place,
                       'place_geo': get_geo(place, self.db),
                       'date': None,
                       'date_num': None,
                       'age': None
                       }
                if event['value']['date']:
                    if event['value']['date'].has_key('normalized'):
                        info['date'] = event['value']['date']['normalized']
                    else:
                        info['date'] = event['value']['date']['original']
                    info['date_num'] = event['value']['date'].get('numeric', None)
                if birth_year is False and (info['type'] == 'Birth'
                                            or info['type'] == 'Christening'):
                    date = ev2date(info)
                    if date:
                        birth_year = date.year
                date = ev2date(info)
                if date and not birth_year is False:
                    info['age'] = date.year - birth_year
                events.append(info)

            for family in person.get('families', []):
                if not family['marriage']:
                    continue
                place = None
                m = family['marriage']['value']
                if m['place']:
                    if m['place']['normalized']:
                        place = m['place']['normalized']['value']
                    else:
                        place = m['place']['original']
                info = {'type': 'Marriage',
                       'place': place,
                       'place_geo': get_geo(place, self.db),
                       'date': None,
                       'age': None,
                       'date_num': None}
                if m['date']:
                    if m['date'].has_key('normalized'):
                        info['date'] = m['date']['normalized']
                    else:
                        info['date'] = m['date']['original']
                    info['date_num'] = m['date'].get('numeric', None)
                date = ev2date(info)
                if birth_year is not False and date:
                    info['age'] = date.year - birth_year
                events.append(info)
        normalize_events(events)
        return events

    def oneplace(self):
        for event in self.events():
            return event
        return False

def normalize_events(events):
    '''Take events of the format [{'type':str, 'date_num':str or None,
    ...}, ...] And order them by type, then by date, and then fill in the
    dates (inserting a "date_fallback" key) where they are missing,
    interpolated from the surrounding dates.

    It also normalized places (adding a place_fallback)
    '''

    events.sort(cmp_ev)

    prev_date = None
    prev_place = None
    for i, event in enumerate(events):
        if event['date_num']:
            dt = txt2date(event['date_num'])
            if prev_date is None:
                for m in range(0, i):
                    events[m]['date_fallback'] = event['date_num']
            else:
                delta = (dt - prev_date[1]).total_seconds() / (i - prev_date[0])
                for m in range(prev_date[0] + 1, i):
                    ndate = datetime.timedelta(0, (m - prev_date[0] + .5) * delta) + prev_date[1]
                    events[m]['date_fallback'] = date2txt(ndate)
            prev_date = i, dt
        if event['place_geo'] and event['place_geo'].has_key('geometry'):
            if prev_place is None:
                for m in range(0, i):
                    events[m]['place_fallback'] = event['place_geo']
            else:
                for m in range(prev_place[0] + 1, i):
                    events[m]['place_fallback'] = event['place_geo']
            prev_place = i, event['place_geo']

    if prev_date:
        txtdate = date2txt(prev_date[1])
        for m in range(prev_date[0] + 1, len(events)):
            events[m]['date_fallback'] = txtdate

    if prev_place:
        for m in range(prev_place[0] + 1, len(events)):
            events[m]['place_fallback'] = prev_place[1]

_geo_cache = {}
def get_geo(address, db):
    '''Get the geocode of an address, caching to the database'''
    if not address:
        return None
    if not _geo_cache.has_key(address):
        cached = db.get('geocodes', address) if db else False
        if not cached:
            cached = geocoding.geocode(address)
            if not cached:
                cached = {}
            if db:
                db.save('geocodes', address, cached)
        _geo_cache[address] = cached
    return _geo_cache[address]

# vim: et sw=4 sts=4
