#!/usr/bin/env python

import json, urllib

GEOCODE_BASE_URL = 'http://maps.googleapis.com/maps/api/geocode/json'

def geocode(address, **geo_args):
    '''Get the geolocation of an address through google's api'''
    if address.lower().startswith('of '):
        address = address[3:]
    geo_args.update({
        'address': address.encode('utf-8'),
        'sensor': 'false'
    })

    url = GEOCODE_BASE_URL + '?' + urllib.urlencode(geo_args)
    print 'placing!', address, url
    result = json.load(urllib.urlopen(url))
    if result['results']:
        return result['results'][0]
    print 'no results', result
    return False

# vim: et sw=4 sts=4
