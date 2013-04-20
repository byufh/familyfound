#!/usr/bin/env python

import json
import urllib
import urllib2
import datetime
import logging
import os

import urllib2, base64

import geocoding

import pymongo
import sqlite3

from .person import Person

class FSBackend:
    def get(self, table, pid):
        '''Take a pid. If the item has been cached, return the dictionary
        equivalent to the JSON data object. If the item has not been cached,
        return false.'''
        raise NotImplemented

    def save(self, table, pid, data):
        '''Save an item to the database'''
        raise NotImplemented

class FSMongo(FSBackend):
    def __init__(self, dbname='familysearch-blank'):
        self.db = pymongo.Connection()[dbname]

    def get(self, table, pid):
        return self.db[table].find_one(pid)

    def save(self, table, pid, data):
        data['_id'] = pid
        self.db[table].save(data)

local = os.path.dirname(os.path.dirname(__file__))
class FSSqlite(FSBackend):
    def __init__(self, dbname=os.path.join(local, 'cache.db')):
        there = os.path.exists(dbname)
        self.name = dbname
        self.con = sqlite3.connect(dbname)
        if not there:
            self.create_tables()

    def create_tables(self):
        with self.con:
            cur = self.con.cursor()
            cur.execute('create table people(pid TEXT PRIMARY KEY, data TEXT)')
            cur.execute('create table geocodes(pid TEXT PRIMARY KEY, data TEXT)')

    def create_table(self, name):
        with self.con:
            cur = self.con.cursor()
            cur.execute('create table %s(pid TEXT PROMARY KEY, data TEXT)' % name)

    def get(self, table, pid):
        with self.con:
            cur = self.con.cursor()
            try:
                cur.execute('select * from %s where pid=?' % table, (pid,))
            except sqlite3.OperationalError as e:
                if e.message.startswith('no such table:'):
                    return False
                raise
            row = cur.fetchone()
            if not row:
                return False
            return json.loads(row[1])

    def save(self, table, pid, data):
        with self.con:
            cur = self.con.cursor()
            try:
                cur.execute('insert or replace into %s values(?, ?)' % table, (pid, json.dumps(data)))
            except sqlite3.OperationalError as e:
                if e.message.startswith('no such table:'):
                    self.create_table(table)
                    cur.execute('insert into %s values(?, ?)' % table, (pid, json.dumps(data)))
                    return
                raise

class FS:
    '''The main class to handle interation with the familysearch API
    
    Attributes:
        - gotten: list if people ID's already cached
        - people: dictionary of peroson objects
        - db    : the database connection ...
    '''

    uris = {
        'familytree': 'https://api.familysearch.org/familytree/v2/',
        'identity': 'https://api.familysearch.org/identity/v2/',
        'login': 'https://api.familysearch.org/identity/v2/login'
        }
    base_options = ['dataFormat=application/json']

    def __init__(self, username=None, password=None, session=None, api_key=None, db=None):
        '''If session is given, resume that session. Otherwise, if username
        and password are given, authenticate and start a new session'''
        self.options = self.base_options[:]
        self.gotten = []
        self.people = {}
        self.db = FSMongo() if db is None else db
        self.sesson = False
        self.api_key = api_key
        if session:
            self.session = session
            self.options.append('sessionId=%s' % session)
        elif username and password:
            self.login(username, password)

    def start_session(self, username, password):
        '''Not using atm'''
        if self.api_key is None:
            raise RuntimeError('No API Key given')
        base64string = base64.encodestring('%s:%s' % (username, password)).replace('\n', '')
        request = urllib2.Request(self.uris['login'] + '?dataFormat=application/json&key=' + self.api_key)
        request.add_header("Authorization", "Basic %s" % base64string)
        result = urllib2.urlopen(request).read()
        return json.loads(result)['session']['id']

    def login(self, username, password):
        self.session = self.start_session(username, password)
        self.options.append('sessionId=%s' % self.session)

    def service(self, name, args, **options):
        logging.info('service request: %s (%s)' % (name, args))
        if not self.session:
            raise Exception('not authenticated')
        url = self.get_url(name, args, **options)
        logging.info('getting URL:' + url)
        text = urllib.urlopen(url).read()
        return json.loads(text)

    def get_url(self, name, args, **options):
        return self.uris[name] + '/'.join(args) + '?' + '&'.join(self.options
                + ['%s=%s' % option for option in options.iteritems()])

    def get_base_person(self):
        options = [
            # 'personas',
            'properties',
            'names',
            'events',
            'characteristics',
            'ordinances',
            'families',
            'parents',
            'children',
            'identifiers',
            # 'contributors',
            'exists']
        kwds = dict((option, 'all') for option in options)
        try:
            return self.service('familytree', ('person',), **kwds)
        except Exception as e:
            logging.error('ERROR getting a person: %s : %s' % (id, e))
            raise

    def get_person(self, id):
        options = [
            # 'personas',
            'properties',
            'names',
            'events',
            'characteristics',
            'ordinances',
            'families',
            'parents',
            'children',
            'identifiers',
            # 'contributors',
            'exists']
        kwds = dict((option, 'all') for option in options)
        try:
            return self.service('familytree', ('person', id), **kwds)
        except Exception as e:
            logging.error('ERROR getting a person: %s : %s' % (id, e))
            raise

    def pull_person(self, id, no_cache=False):
        if id in self.gotten:
            return self.people[id]
        data = self.db.get('people', id)
        if no_cache or not data:
            data = self.get_person(id)
            if data['statusCode'] == 400:
                return False
            self.db.save('people', id, data)
        self.gotten.append(id)
        person = Person(data, self)
        self.people[id] = person
        return person

    def pull_tree_gen(self, ids, gens, demo=False, no_cache=False):
        '''Get the tree - returning a generator'''
        cgen = 0
        next_gen = ids
        yield {'gen': 0, 'people': ids}
        for cgen in range(1, gens + 2):
            logging.info('Gen %d: %d people' % (cgen, len(next_gen)))
            ids = next_gen
            next_gen = []
            for id, link in ids:
                if id in self.gotten:
                    ## loop!
                    logging.info('Got the same person twice: %s' % id)
                    person = self.people[id]
                    yield {'person': person.tojson(), 'gen': cgen, 'pid': id}
                    continue
                else:
                    data = self.db.get('people', id)
                    if not data or no_cache:
                        logging.info('getting data from the mothership for %s' % id)
                        data = self.get_person(id)
                        data['link'] = link
                        logging.info('GOT: %s' % str(data)[:100])
                        self.db.save('people', id, data)
                    data['link'] = link
                    self.gotten.append(id)
                    person = Person(data, self)
                    self.people[id] = person
                yield {'person': person.tojson(), 'gen': cgen, 'pid': id}

                for parent in person.parents():
                    next_gen.append((parent[0], id))
            yield {'gen': cgen, 'people': next_gen}

    """
    def pull_tree(self, ids, gens):
        '''Get the tree flat'''
        if gens == 0:
            return []
        next_gen = []
        for id in ids:
            if id in self.gotten:
                person = self.people[id]
            else:
                data = self.db.get('people', id)
                if not data:
                    data = self.get_person(id)
                    self.db.save('people', id, data)
                self.gotten.append(id)
                person = Person(data)
                self.people[id] = person
            for parent in person.parents():
                next_gen.append(parent[0])
        return [next_gen] + self.pull_tree(next_gen, gens-1)
    """

    def get_pedigree(self, base, gens = 9):
        '''Get the pedigree - list of person ids'''
        res = self.pull_tree([base], gens)
        return [[base]] + res

def user_info(session, db):
    fs = FS(session=session, db=db)
    try:
        data = fs.service('familytree', ('user',))
    except IOError as e:
        return False
    user = data['users'][0]
    name = user['contactName']
    user['name'] = name
    '''
    names = data['users'][0]['names']
    dname = None
    for name in names:
        if name['type'] == 'Display':
            dname = name['value']
    if not dname:
        raise Exception('invalid response from FS: no display name given')
    info = data['users'][0]
    info['name'] = dname
    '''
    return user

base = 'KWQX-56D'
#### Working with Dates and Events

gotten = []
people = {}

# vim: et sw=4 sts=4
