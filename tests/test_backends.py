#!/usr/bin/env python

import os
from familyfound.fsapi import FSMongo, FSSqlite

import pytest

SQDB = 'test-db.db'
MGDB = 'test-ff'

def test_fcreate_sqlite():
    if os.path.isfile(SQDB):
        os.remove(SQDB)
    f = FSSqlite(SQDB)
    assert os.path.exists(SQDB)

def test_get(db):
    db.save('people', 'kqz', {'hi':'ho'})
    p = db.get('people', 'kqz')
    assert p and p['hi'] == 'ho'

def test_noget(db):
    assert not db.get('people', 'nobody')


# vim: et sw=4 sts=4
