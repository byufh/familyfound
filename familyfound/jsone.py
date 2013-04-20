#!/usr/bin/env python

import fsapi
from geocoding import geocode

fsapi.get_pedigree()

data = []

for key, value in fsapi.people.iteritems():
    place = value.oneplace()
    if place:
        geoplace = geocode(place['place'])
        data.append([value.name, geoplace])

import json
fn = open('oneplace.json', 'w')
fn.write(json.dumps(data))
fn.close()

# vim: et sw=4 sts=4
