#!/usr/bin/env python

import os
import tempfile
import pytest
from familyfound.fsapi import FSMongo, FSSqlite

SQDB = 'test-db.db'
MGDB = 'test-ff'

SQDB = 'test-db.db'
MGDB = 'test-ff'
def pytest_generate_tests(metafunc):
    if 'db' in metafunc.funcargnames:
        metafunc.parametrize('db', [FSMongo(MGDB), FSSqlite(SQDB)])

@pytest.mark.funcarg(params=[FSMongo(MGDB), FSSqlite(SQDB)])
def db(request):
    return request.param

def setup_db():
    fd, fn = tempfile.mkstemp()
    db = FSSqlite(fn)
    db.fd = fd
    return db

def teardown_db(db):
    os.close(db.fd)
    os.unlink(db.name)

def pytest_funcarg__flaskdb(request):
    return request.cached_setup(
            setup = setup_db,
            teardown = teardown_db,
            scope = 'module')

# vim: et sw=4 sts=4
