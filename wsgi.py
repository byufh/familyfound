#!/usr/bin/env python

from flask import (Flask, session, redirect, url_for, escape,
                   request, render_template, Response)
from flask.ext.cache import Cache
from flask_sslify import SSLify

from familyfound.oauths import request_token, authorize_url, access_token
from familyfound.person import Person
import familyfound

import json
import os

from sqlite_session import SqliteSessionInterface

application = app = Flask(__name__)
app.config.from_object('config')
sslify = SSLify(app, permanent=True)
# cache = Cache(app)

import logging
default_logfile = os.path.join(os.path.dirname(__file__), 'debug.log')
logger = logging.getLogger()
logger.setLevel(logging.INFO)
logger.addHandler(logging.FileHandler(filename=app.config.get('LOGFILE', default_logfile)))
logger.addHandler(logging.StreamHandler())

path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'sessions'))
if not os.path.exists(path):
    os.mkdir(path)
    os.chmod(path, int('700', 8))
app.session_interface = SqliteSessionInterface(path)

def makedb(conf):
    if conf['type'] not in familyfound.backends:
        raise ValueError('Invalid backend')
    return familyfound.backends[conf['type']](conf['name'])

'''
@app.route('/csess')
def csess():
    session.clear()
    return 'Session cleared!'

@app.route('/sess')
def sess():
    return json.dumps(dict(session.items()))
'''

@app.route('/')
def main():
    return render_template('home.html')

@app.route('/urls.js')
def urls_js():
    '''Generate the URL mappings for the javascript page'''
    tpl = 'var URLS = %s;'
    toinclude = 'check-login', 'get-pedigree', 'reload-pedigree', 'reload-person'
    urls = dict((name, url_for(name.replace('-', '_'))) for name in toinclude)
    return tpl % json.dumps(urls)

@app.route('/oauth/check-login')
def check_login():
    '''If the person is already logged in, fetch their data from FS. Otherwise
    initialize the OAuth procedure.'''

    logging.info('Checking Login')
    DB = makedb(app.config['DB'])
    if app.config.get('DEMO', False) or app.config.get('SKIP_LOGIN', False):
        info = DB.get('user_info', 'DEMO')
        if info:
            logging.info('DEMO MODE: overriding user info with ' + str(info))
            return json.dumps({'authorized': True, 'user': info})

    try:
        tok = session['oauth_token']
    except KeyError:
        tok = None
    if tok is not None:
        logging.info('found oauth token: ' + tok)
        fs = familyfound.FS(session=session['oauth_token'], db=DB)
        try:
            info = fs.get_base_person()
        except:
            info = False
        if info:
            info = Person(info, fs).tojson()
            if app.config['SANDBOX']:
                info['id'], info['name'] = app.config['BASE_PERSON']
                DB.save('user_info', 'DEMO', info)
            text = json.dumps({'authorized': True, 'user': info})
            session['user_info'] = text
            # keep track of base user's id
            return text

    del session['oauth_token']
    del session['oauth_secret']
    del session['oauth_r_secret']
    del session['user_info']
    pref = 'https://'
    redirect = pref + app.config['SERVER_NAME'] + url_for('authorize')
    token, secret = request_token(app.config['API_KEY'], redirect)
    if not secret:
        logging.warning('API call failed requesting a token (step 1)')
        return json.dumps({'authorized': False, 'error': 'Invalid response from familysearch'})
    session['oauth_r_secret'] = secret
    oauth_url =  authorize_url(token)
    logging.info('Got OAUTH url: ' + oauth_url)
    return json.dumps({'authorized': False, 'url': oauth_url})

@app.route('/oauth/authorize')
def authorize():
    '''OAuth callback. This means the person authorized us to use
    familysearch. We get the credentials and send up the user info'''

    verifier = request.args.get('oauth_verifier', '')
    token = request.args.get('oauth_token', '')
    ss_secret = session.pop('oauth_r_secret', '')
    logging.info('OAUTH step 3: authorize called')
    if not verifier or not token or not ss_secret:
        logging.info('OAUTH : some data missing! %s %s %s' % (verifier, token, ss_secret))
        return render_template('oauth_problems.html',
                               stuff=str([verifier, token, ss_secret]))
    atoken, asecret = access_token(app.config['API_KEY'], verifier, token, ss_secret)
    session['oauth_token'] = atoken
    session['oauth_secret'] = asecret
    DB = makedb(app.config['DB'])
    fs = familyfound.FS(session=atoken, db=DB)
    info = Person(fs.get_base_person(), fs).tojson()
    if app.config['SANDBOX']:
        logging.info('User Info overridden [sandbox mode]: %s'
                     % (app.config['BASE_PERSON'],))
        info['id'], info['name'] = app.config['BASE_PERSON']
    return render_template('authorized.html', user_info=json.dumps(info))

@app.route('/ajax/reload-person/<person_id>')
@app.route('/ajax/reload-person/')
def reload_person(person_id=None):
    '''Reload a person from FamilySearch API (bypass cached copy)'''
    ssid = session['oauth_token']
    if app.config.get('DEMO', False):
        ssid = None
    logging.info('reloading the person %s' % (person_id,))
    DB = makedb(app.config['DB'])
    fs = familyfound.FS(session = ssid, db=DB)
    person = fs.pull_person(person_id, True)
    return json.dumps({'success': True, 'person': person.tojson()})

@app.route('/ajax/reload-pedigree/<person_id>')
@app.route('/ajax/reload-pedigree/')
def reload_pedigree(person_id=None):
    '''Reload a pedigree from FS api (bypass cache)'''
    ssid = session['oauth_token']
    try:
        gens = int(request.args.get('generations', app.config['DEFAULT_GENS']))
    except ValueError:
        gens = app.config['DEFAULT_GENS']
    if app.config.get('DEMO', False):
        ssid = None
    logging.info('reloading the %d gen pedigree for %s' % (gens, person_id))
    DB = makedb(app.config['DB'])
    fs = familyfound.FS(session = ssid, db=DB)
    def get_iter():
        if app.config.get('DEMO', False):
            # if it's in demo mode, still don't hit the API
            itr = fs.pull_tree_gen([(person_id, None)], gens, demo=True)
        else:
            itr = fs.pull_tree_gen([(person_id, None)], gens, no_cache=True)
        for data in itr:
            yield json.dumps(data) + '\n'
    return Response(get_iter(), mimetype='text/plain')

@app.route('/ajax/get-person/<person_id>')
def get_person(person_id):
    '''Just get data for a single person'''
    ssid = session['oauth_token']
    if app.config.get('DEMO', False):
        ssid = None
    DB = makedb(app.config['DB'])
    fs = familyfound.FS(session = ssid, db=DB)
    person = fs.pull_person(person_id)
    if not person:
        res = {'error': 'invalid person id', 'success': False}
    else:
        res = {'person': person.tojson(), 'success': True}
    return json.dumps(res)

@app.route('/ajax/get-pedigree/<person_id>')
@app.route('/ajax/get-pedigree/')
def get_pedigree(person_id=None):
    '''Generatively send the 9gen pedigree for this person'''
    ssid = session['oauth_token']
    try:
        gens = int(request.args.get('generations', app.config['DEFAULT_GENS']))
    except ValueError:
        gens = app.config['DEFAULT_GENS']
    if app.config.get('DEMO', False):
        ssid = None
    logging.info('getting the %d gen pedigree for %s' % (gens, person_id))
    DB = makedb(app.config['DB'])
    fs = familyfound.FS(session = ssid, db=DB)
    def get_iter():
        if app.config.get('DEMO', False):
            itr = fs.pull_tree_gen([(person_id, None)], gens, demo=True)
        else:
            itr = fs.pull_tree_gen([(person_id, None)], gens)
        for data in itr:
            yield json.dumps(data) + '\n'
    return Response(get_iter(), mimetype='text/plain')

if __name__ == '__main__':
    # Bind to PORT if defined, otherwise default to 5000.
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

# vim: et sw=4 sts=4
