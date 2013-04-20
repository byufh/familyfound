#!/usr/bin/env python

import fsapi

fsapi.get_pedigree()

people = {}
for pid, person in fsapi.people.iteritems():
    people[pid] = person.tojson()

import json
fn = open('all_people.json', 'w')
fn.write(json.dumps(people))
fn.close()

# vim: et sw=4 sts=4
