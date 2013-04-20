#!/usr/bin/env python

import pytest
import tempfile
import json
import familyfound

one = pytest.mark.one

special = False
try:
    from special import data as special
except ImportError:
    pass

def tok_setup():
    un, pw = special
    from app import app
    fs = familyfound.FS(un, pw, api_key=app.config['API_KEY'])
    return fs.session

def pytest_funcarg__tok(request):
    return request.cached_setup(
            setup = tok_setup,
            scope = 'module')

def sess(fn):
    def meta(tok, flaskdb):
        import app
        reload(app)
        app.DB = flaskdb
        with app.app.test_client() as c:
            with c.session_transaction() as sess:
                sess['oauth_token'] = tok
            fn(c, app, flaskdb)
    return meta

def test_logincheck():
    from app import app
    ma = app.test_client()
    r = ma.get('/oauth/check-login')
    data = json.loads(r.data)
    assert data['authorized'] == False
    assert data['url'].startswith('https://')

def test_login_session():
    from app import app
    ma = app.test_client()
    r = ma.get('/oauth/check-login')
    data = json.loads(r.data)
    assert data['authorized'] == False
    assert data['url'].startswith('https://')
    r2 = ma.get('/sess')
    data = json.loads(r2.data)
    assert data.has_key('oauth_r_secret') and data['oauth_r_secret']

def test_login2(tok):
    from app import app
    import flask
    with app.test_client() as c:
        with c.session_transaction() as sess:
            sess['oauth_token'] = tok
        r = c.get('/oauth/check-login')
        data = json.loads(r.data)
        assert data['authorized']
        assert data.has_key('user')
if not special:
    test_login2 = pytest.mark.skip(test_login2)

@sess
def test_get_person(client, app, db):
    res = client.get('/ajax/get-person/ABC')
    data = json.loads(res.data)
    assert data.has_key('error')
    assert data['success'] == False

@one
@sess
def test_get_real_person(client, app, db):
    '''Try to fetch a real person from familysearch'''
    res = client.get('/ajax/get-person/' + app.app.config['BASE_PERSON'][0])
    data = json.loads(res.data)
    assert data['success']
    assert data['person'].has_key('names')
    assert len(data['person']['parents']) == 2




# vim: et sw=4 sts=4
